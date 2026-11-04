import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    coveredPeriods,
    type DrizzleClient,
    desc,
    eq,
    getDb,
    isNull,
    manualPaymentModel,
    type ReconciliationMarkReason,
    subscriptions
} from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { isSystemActor } from '../../../utils/system-actor';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import {
    type OpenReconciliationMarkPorts,
    openReconciliationMark
} from '../reconciliation/open-reconciliation-mark.service';

const inputSchema = z.strictObject({
    actor: z.strictObject({
        id: z.uuid(),
        roles: z.array(z.enum(RoleEnum)),
        permissions: z.array(z.enum(PermissionEnum))
    }),
    subscriptionId: z.uuid(),
    proofRef: z.string().min(1).optional()
});
const coverageIndex = 'uq_covered_period_open_subscription_period';
const uncovered = Symbol('uncovered');

/** Stable MP6 rejection reasons. */
export const REGISTER_UNALLOCATED_MANUAL_PAYMENT_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MANUAL_PAYMENT_NOT_MANUAL',
    'MANUAL_PAYMENT_NO_PERIOD',
    'MANUAL_PAYMENT_OPEN_INSTALLMENT',
    'MANUAL_PAYMENT_PERIOD_NOT_COVERED',
    'MANUAL_PAYMENT_NOT_ALLOCATABLE'
] as const;

/** The MP6 mark selected from the subscription and installment state. */
export type UnallocatedManualPaymentMark = 'COBRO_DUPLICADO' | 'COBRO_POSTERIOR_A_LA_BAJA';

/** Ports for the MP6 mark and its immediate admin notice. */
export interface RegisterUnallocatedManualPaymentPorts {
    readonly clock: Clock;
    readonly markPayments?: OpenReconciliationMarkPorts['markPayments'];
    readonly markNotice?: OpenReconciliationMarkPorts['notice'];
}

type Input = { readonly actor: Actor; readonly subscriptionId: string; readonly proofRef?: string };

function reject(reason: (typeof REGISTER_UNALLOCATED_MANUAL_PAYMENT_REJECTIONS)[number]): never {
    const code =
        reason === 'SUBSCRIPTION_NOT_FOUND'
            ? ServiceErrorCode.NOT_FOUND
            : reason === 'ADMINISTRATIVE_ACTION_FORBIDDEN'
              ? ServiceErrorCode.FORBIDDEN
              : ServiceErrorCode.VALIDATION_ERROR;
    throw new ServiceError(code, reason, undefined, reason);
}

async function check(
    input: Input,
    tx: DrizzleClient,
    lock: boolean
): Promise<{
    readonly periodStart: Date;
    readonly mark: UnallocatedManualPaymentMark;
}> {
    const query = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    const [subscription] = lock ? await query.for('update') : await query;
    if (!subscription) reject('SUBSCRIPTION_NOT_FOUND');
    const permitted = isAdministrativeActionPermitted({
        action: 'ACC_3',
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: 'ACC_3',
        actorId: input.actor.id,
        subjectId: subscription.userId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) reject('ADMINISTRATIVE_ACTION_FORBIDDEN');
    if (subscription.paymentMethod !== 'MANUAL') reject('MANUAL_PAYMENT_NOT_MANUAL');

    const latest = await manualPaymentModel.findLatestInstallment({
        subscriptionId: subscription.id,
        tx,
        lock
    });
    const periodStart =
        latest?.periodStart ??
        (
            await tx
                .select({ periodStart: coveredPeriods.periodStart })
                .from(coveredPeriods)
                .where(
                    and(
                        eq(coveredPeriods.subscriptionId, subscription.id),
                        isNull(coveredPeriods.releasedAt)
                    )
                )
                .orderBy(desc(coveredPeriods.periodStart))
                .limit(1)
        )[0]?.periodStart;
    if (!periodStart) reject('MANUAL_PAYMENT_NO_PERIOD');
    const awaiting = await manualPaymentModel.findAwaitingInstallment({
        subscriptionId: subscription.id,
        tx
    });
    if (awaiting || (subscription.status === 'SUSPENDED' && latest?.status === 'DECLARED_UNPAID'))
        reject('MANUAL_PAYMENT_OPEN_INSTALLMENT');

    if (subscription.status === 'CANCELLED' && latest?.status === 'DECLARED_UNPAID')
        return { periodStart, mark: 'COBRO_POSTERIOR_A_LA_BAJA' };
    if (subscription.status === 'ABANDONED') {
        const first = await manualPaymentModel.findFirstInstallment({
            subscriptionId: subscription.id,
            tx
        });
        if (first?.status === 'DECLARED_UNPAID')
            return { periodStart, mark: 'COBRO_POSTERIOR_A_LA_BAJA' };
    }
    if (latest && latest.status !== 'REGISTERED') reject('MANUAL_PAYMENT_NOT_ALLOCATABLE');
    if (!lock) {
        const [coverage] = await tx
            .select({ id: coveredPeriods.id })
            .from(coveredPeriods)
            .where(
                and(
                    eq(coveredPeriods.subscriptionId, subscription.id),
                    eq(coveredPeriods.periodStart, periodStart),
                    isNull(coveredPeriods.releasedAt)
                )
            )
            .limit(1);
        if (!coverage) reject('MANUAL_PAYMENT_PERIOD_NOT_COVERED');
    }
    return { periodStart, mark: 'COBRO_DUPLICADO' };
}

/** Previews MP6 without writing; coverage is inspected for the duplicate branch. */
export async function previewUnallocatedManualPayment(input: Input): Promise<{
    readonly subscriptionId: string;
    readonly periodStart: Date;
    readonly mark: UnallocatedManualPaymentMark;
}> {
    const parsed = inputSchema.parse(input);
    const checked = await getDb().transaction((tx) =>
        check({ ...parsed, actor: input.actor }, tx, false)
    );
    return { subscriptionId: parsed.subscriptionId, ...checked };
}

/** Registers an MP6 transfer and hangs it on the S14 mark in one transaction. */
export async function registerUnallocatedManualPayment(
    input: Input,
    ports: RegisterUnallocatedManualPaymentPorts
): Promise<{
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly markId: string;
    readonly mark: UnallocatedManualPaymentMark;
    readonly outcome: 'OPENED' | 'ACCUMULATED';
}> {
    const parsed = inputSchema.parse(input);
    const now = ports.clock.now();
    return getDb().transaction(async (tx) => {
        const checked = await check({ ...parsed, actor: input.actor }, tx, true);
        const row = await manualPaymentModel.insertRegisteredUnallocated({
            subscriptionId: parsed.subscriptionId,
            periodStart: checked.periodStart,
            registeredBy: input.actor.id,
            registeredAt: now,
            proofRef: parsed.proofRef,
            tx
        });
        if (checked.mark === 'COBRO_DUPLICADO') {
            try {
                await tx.transaction(async (savepoint) => {
                    await savepoint.insert(coveredPeriods).values({
                        subscriptionId: parsed.subscriptionId,
                        periodStart: checked.periodStart,
                        manualPaymentId: row.id,
                        creditedAt: now
                    });
                    throw uncovered;
                });
            } catch (error) {
                if (error === uncovered) reject('MANUAL_PAYMENT_PERIOD_NOT_COVERED');
                const cause = extractPostgresErrorCause(error);
                if (cause?.code !== '23505' || cause.constraint !== coverageIndex) throw error;
            }
        }
        const reason: ReconciliationMarkReason = checked.mark;
        const result = await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId: parsed.subscriptionId },
                reason,
                payment: { source: 'MANUAL_PAYMENT', id: row.id },
                actor: { type: 'admin', id: input.actor.id },
                correlationId: row.id,
                tx
            },
            {
                markPayments:
                    ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock),
                notice: ports.markNotice
            }
        );
        return {
            manualPaymentId: row.id,
            periodStart: checked.periodStart,
            markId: result.mark.id,
            mark: checked.mark,
            outcome: result.outcome
        };
    });
}
