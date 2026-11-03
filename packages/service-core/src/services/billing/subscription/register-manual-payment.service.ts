import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    coveredPeriods,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    manualPaymentModel,
    manualPayments,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    BILLING_CYCLE_MONTHS,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnumSchema
} from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { isSystemActor } from '../../../utils/system-actor';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { emitBillingFact } from '../facts/billing-fact-sink';
import { issueReceipt, readReceiptPayer } from '../payment/issue-receipt';
import type { CoverageNotices } from '../payment/payment-ports';
import { billingPeriodEnd } from './billing-period-end';
import { reactivateFromGrace } from './exit-grace.service';
import { hasOtherLivePrincipal, isLiveSuccessionPredecessor } from './late-payment-conditions';
import { enqueueSignupConfirmedNotice } from './signup-confirmed-notice';
import { retainPaymentForSuccession } from './succession-retained-payment';

const logger = createLogger('register-manual-payment');
const inputSchema = z.strictObject({
    actor: z.object({
        id: z.uuid(),
        roles: z.array(z.enum(RoleEnum)),
        permissions: z.array(z.enum(PermissionEnum))
    }),
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    proofRef: z.string().min(1).optional()
});
const COVERAGE_INDEX = 'uq_covered_period_open_subscription_period';

/** Stable reasons returned by MP1. */
export const REGISTER_MANUAL_PAYMENT_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'MANUAL_PAYMENT_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MANUAL_PAYMENT_NOT_MANUAL',
    'MANUAL_PAYMENT_NOT_AWAITING',
    'MANUAL_PAYMENT_STATE_NOT_ALLOWED',
    'MANUAL_PAYMENT_CONDITION_FAILED',
    'MANUAL_PAYMENT_COVERAGE_CONFLICT',
    'LOST_RACE'
] as const;

/** One rejected MP1 condition. */
export type RegisterManualPaymentRejection = (typeof REGISTER_MANUAL_PAYMENT_REJECTIONS)[number];
/** The transition caused by a successful MP1. */
export type ManualPaymentRegistrationEffect = 'S29' | 'S5' | 'S19';
/** Dependencies of MP1's post-commit work. */
export interface RegisterManualPaymentPorts {
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    readonly afterActivation?: (input: {
        readonly subscription: {
            readonly id: string;
            readonly userId: string | null;
            readonly vertical: string | null;
            readonly succeedsId: string | null;
        };
    }) => Promise<unknown>;
}

function reject(code: ServiceErrorCode, reason: RegisterManualPaymentRejection): never {
    throw new ServiceError(code, reason, undefined, reason);
}

type Input = {
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly proofRef?: string;
};
type Checked = {
    readonly subscription: typeof subscriptions.$inferSelect;
    readonly installment: typeof manualPayments.$inferSelect;
    readonly effect: ManualPaymentRegistrationEffect;
    readonly nextChargeAt: Date;
};

async function check(input: Input, tx: DrizzleClient, lock: boolean): Promise<Checked> {
    // Lock order is subscription, then installment, including on concurrent MP1 calls.
    const query = tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    const [subscription] = lock ? await query.for('update') : await query;
    if (!subscription) reject(ServiceErrorCode.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND');
    const [installment] = lock
        ? [await manualPaymentModel.lockInstallment({ manualPaymentId: input.manualPaymentId, tx })]
        : await tx
              .select()
              .from(manualPayments)
              .where(eq(manualPayments.id, input.manualPaymentId))
              .limit(1);
    if (!installment || installment.subscriptionId !== subscription.id)
        reject(ServiceErrorCode.NOT_FOUND, 'MANUAL_PAYMENT_NOT_FOUND');
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
    if (!step.allowed) reject(ServiceErrorCode.FORBIDDEN, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
    if (subscription.paymentMethod !== 'MANUAL' || subscription.class !== 'PRINCIPAL')
        reject(ServiceErrorCode.VALIDATION_ERROR, 'MANUAL_PAYMENT_NOT_MANUAL');
    if (installment.status !== 'AWAITING')
        reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_NOT_AWAITING');
    const first = await manualPaymentModel.isFirstInstallment({
        subscriptionId: subscription.id,
        manualPaymentId: installment.id,
        tx
    });
    if (
        subscription.status !== 'ACTIVE' &&
        subscription.status !== 'GRACE_PERIOD' &&
        !(subscription.status === 'PENDING_AUTHORIZATION' && first)
    )
        reject(ServiceErrorCode.VALIDATION_ERROR, 'MANUAL_PAYMENT_STATE_NOT_ALLOWED');
    let effect: ManualPaymentRegistrationEffect =
        subscription.status === 'PENDING_AUTHORIZATION' ? 'S29' : 'S5';
    if (subscription.status === 'GRACE_PERIOD') {
        if (await isLiveSuccessionPredecessor({ subscriptionId: subscription.id, tx }))
            effect = 'S19';
        else if (subscription.succeededById || (await hasOtherLivePrincipal({ subscription, tx })))
            reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_CONDITION_FAILED');
    }
    if (subscription.status === 'ACTIVE') effect = 'S5'; // Registration has no state transition.
    const [option] = subscription.billingOptionId
        ? await tx
              .select({ cycle: billingOptions.cycle })
              .from(billingOptions)
              .where(eq(billingOptions.id, subscription.billingOptionId))
              .limit(1)
        : [];
    if (!option || !Object.hasOwn(BILLING_CYCLE_MONTHS, option.cycle))
        reject(ServiceErrorCode.INTERNAL_ERROR, 'MANUAL_PAYMENT_CONDITION_FAILED');
    const everyMonths = BILLING_CYCLE_MONTHS[option.cycle as keyof typeof BILLING_CYCLE_MONTHS];
    const nextChargeAt = billingPeriodEnd({
        periodStart: installment.periodStart,
        everyMonths
    }).periodEnd;
    if (!lock) {
        const [conflict] = await tx
            .select({ id: coveredPeriods.id })
            .from(coveredPeriods)
            .where(
                and(
                    eq(coveredPeriods.subscriptionId, subscription.id),
                    eq(coveredPeriods.periodStart, installment.periodStart),
                    isNull(coveredPeriods.releasedAt)
                )
            )
            .limit(1);
        if (conflict) reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_COVERAGE_CONFLICT');
    }
    return { subscription, installment, effect, nextChargeAt };
}

/** Read-only MP1 preview with the same business rejection checks as registration. */
export async function previewManualPaymentRegistration(input: Input): Promise<{
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly effect: ManualPaymentRegistrationEffect;
    readonly nextChargeAt: Date;
}> {
    const parsed = inputSchema.parse(input);
    const checked = await getDb().transaction((tx) =>
        check({ ...parsed, actor: input.actor }, tx, false)
    );
    return {
        subscriptionId: checked.subscription.id,
        manualPaymentId: checked.installment.id,
        periodStart: checked.installment.periodStart,
        effect: checked.effect,
        nextChargeAt: checked.nextChargeAt
    };
}

/** MP1 registers an awaiting installment, coverage and receipt atomically. */
export async function registerManualPayment(
    input: Input,
    ports: RegisterManualPaymentPorts
): Promise<{
    readonly outcome: 'REGISTERED';
    readonly effect: ManualPaymentRegistrationEffect;
    readonly receiptId: string;
    readonly receiptNumber: number;
    readonly nextChargeAt: Date;
}> {
    const parsed = inputSchema.parse(input);
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const checked = await check({ ...parsed, actor: input.actor }, tx, true);
        const { subscription, installment, effect, nextChargeAt } = checked;
        const wrote = await manualPaymentModel.markRegistered({
            manualPaymentId: installment.id,
            registeredBy: input.actor.id,
            registeredAt: now,
            proofRef: parsed.proofRef,
            tx
        });
        if (!wrote) reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_NOT_AWAITING');
        try {
            await tx.transaction(async (savepoint) => {
                await savepoint.insert(coveredPeriods).values({
                    subscriptionId: subscription.id,
                    periodStart: installment.periodStart,
                    manualPaymentId: installment.id,
                    creditedAt: now
                });
            });
        } catch (error) {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505' && cause.constraint === COVERAGE_INDEX)
                reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_COVERAGE_CONFLICT');
            throw error;
        }
        const { payer } = await readReceiptPayer({ tx, userId: subscription.userId });
        const receipt = await issueReceipt({
            tx,
            source: { kind: 'MANUAL_PAYMENT', manualPaymentId: installment.id },
            payer,
            issuedAt: now
        });
        await tx
            .update(subscriptions)
            .set({ nextChargeAt, updatedAt: now })
            .where(eq(subscriptions.id, subscription.id));
        if (effect === 'S29') {
            const activated = await subscriptionModel.activatePendingAuthorization({
                subscriptionId: subscription.id,
                now,
                tx
            });
            if (!activated) reject(ServiceErrorCode.ALREADY_EXISTS, 'LOST_RACE');
            await enqueueSignupConfirmedNotice({
                tx,
                subscriptionId: subscription.id,
                activatedAt: now
            });
        } else if (effect === 'S19') {
            await retainPaymentForSuccession({
                subscriptionId: subscription.id,
                payment: { source: 'MANUAL_PAYMENT', id: installment.id },
                unpaidSince: subscription.graceStartedAt ?? now,
                now,
                tx
            });
        } else if (subscription.status === 'GRACE_PERIOD') {
            const reactivated = await reactivateFromGrace({
                subscriptionId: subscription.id,
                now,
                tx
            });
            if (!reactivated) reject(ServiceErrorCode.ALREADY_EXISTS, 'LOST_RACE');
        }
        return {
            result: { outcome: 'REGISTERED' as const, effect, ...receipt, nextChargeAt },
            subscription
        };
    });
    if (committed.result.effect === 'S29') {
        if (ports.afterActivation)
            await ports.afterActivation({ subscription: committed.subscription });
        else
            logger.warn(
                { subscriptionId: committed.subscription.id },
                'Activation post-commit port is not wired'
            );
    }
    if (
        committed.result.effect === 'S5' &&
        committed.subscription.status === 'GRACE_PERIOD' &&
        committed.subscription.userId
    ) {
        const vertical = VerticalEnumSchema.safeParse(committed.subscription.vertical);
        if (vertical.success)
            emitBillingFact({
                sink: ports.billingFacts,
                fact: {
                    kind: 'RECOVERED',
                    userId: committed.subscription.userId,
                    vertical: vertical.data,
                    subscriptionId: committed.subscription.id,
                    subscriptionClass: 'PRINCIPAL',
                    actorKind: 'SYSTEM',
                    occurredAt: now,
                    recoveredFrom: 'GRACE_PERIOD',
                    paymentId: input.manualPaymentId
                }
            });
    }
    return committed.result;
}
