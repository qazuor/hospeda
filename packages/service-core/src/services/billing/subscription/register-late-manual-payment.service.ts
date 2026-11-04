import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    coveredPeriods,
    type DrizzleClient,
    domainEventModel,
    eq,
    getDb,
    isNull,
    manualPaymentModel,
    manualPayments,
    type SelectSubscription,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { BILLING_CYCLE_MONTHS, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { z } from 'zod';
import { type Actor, ServiceError } from '../../../types';
import { isSystemActor } from '../../../utils/system-actor';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { issueReceipt, readReceiptPayer } from '../payment/issue-receipt';
import type { CoverageNotices } from '../payment/payment-ports';
import { unwiredCoverageNotices } from '../payment/payment-ports';
import { resumeComplementsS33 } from './complement-resume-s33';
import { checkLatePaymentConditions } from './late-payment-conditions';
import {
    candidateManualPaymentPeriod,
    claimManualPaymentPeriod,
    type ManualPaymentPeriod
} from './manual-payment-reimputation';
import type { ReactivateSuspendedPorts } from './reactivate-suspended.service';
import {
    cancelInheritedTouristVipAfterCommit,
    emitAddedAfterCommit
} from './reactivate-suspended-after-commit';
import { applyOverdueScheduledChangeOnReturn } from './scheduled-change-on-return';
import {
    type ScheduledChangeApplier,
    unimplementedScheduledChangeApplier
} from './subscription-billing-ports';
import { retainPaymentForSuccession } from './succession-retained-payment';

const logger = createLogger('register-late-manual-payment');
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

/** Stable reasons returned by MP4. */
export const REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS = [
    'SUBSCRIPTION_NOT_FOUND',
    'MANUAL_PAYMENT_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'MANUAL_PAYMENT_NOT_MANUAL',
    'MANUAL_PAYMENT_NOT_DECLARED_UNPAID',
    'MANUAL_PAYMENT_NOT_SUSPENDED',
    'MANUAL_PAYMENT_CONDITION_FAILED',
    'MANUAL_PAYMENT_COVERAGE_CONFLICT',
    'RETAINED_PAYMENT',
    'LOST_RACE'
] as const;

/** One MP4 rejection. */
export type RegisterLateManualPaymentRejection =
    (typeof REGISTER_LATE_MANUAL_PAYMENT_REJECTIONS)[number];

/** Optional post-commit integrations for the S7 return. */
export interface RegisterLateManualPaymentPorts {
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    readonly complementPorts?: Omit<
        ReactivateSuspendedPorts,
        'clock' | 'coverageNotices' | 'billingFacts' | 'scheduledChangeApplier'
    >;
}

type Input = {
    readonly actor: Actor;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly proofRef?: string;
};

function reject(code: ServiceErrorCode, reason: RegisterLateManualPaymentRejection): never {
    throw new ServiceError(code, reason, undefined, reason);
}

type Checked = {
    readonly subscription: SelectSubscription;
    readonly installment: typeof manualPayments.$inferSelect;
    readonly everyMonths: number;
    readonly amount: { readonly amountMinor: number; readonly currency: string };
};

function lateConditionsInput(checked: Checked, tx: DrizzleClient) {
    return {
        source: 'manual' as const,
        subscription: checked.subscription,
        manualPaymentId: checked.installment.id,
        paymentAmount: checked.amount,
        expectedAmount: checked.amount,
        admittedStatuses: ['SUSPENDED'],
        tx
    };
}

async function check(input: Input, tx: DrizzleClient, lock: boolean): Promise<Checked> {
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
    if (installment.status !== 'DECLARED_UNPAID')
        reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_NOT_DECLARED_UNPAID');
    if (subscription.status !== 'SUSPENDED')
        reject(ServiceErrorCode.VALIDATION_ERROR, 'MANUAL_PAYMENT_NOT_SUSPENDED');
    const [option] = subscription.billingOptionId
        ? await tx
              .select({
                  cycle: billingOptions.cycle,
                  amount: billingOptions.amount,
                  currency: billingOptions.currency
              })
              .from(billingOptions)
              .where(eq(billingOptions.id, subscription.billingOptionId))
              .limit(1)
        : [];
    if (!option || !Object.hasOwn(BILLING_CYCLE_MONTHS, option.cycle))
        reject(ServiceErrorCode.INTERNAL_ERROR, 'MANUAL_PAYMENT_CONDITION_FAILED');
    const everyMonths = BILLING_CYCLE_MONTHS[option.cycle as keyof typeof BILLING_CYCLE_MONTHS];
    return {
        subscription,
        installment,
        everyMonths,
        amount: { amountMinor: option.amount, currency: option.currency }
    };
}

async function previewPeriod(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
}): Promise<ManualPaymentPeriod> {
    const candidate = candidateManualPaymentPeriod(input);
    const conflict = async (periodStart: Date) => {
        const [covered] = await input.tx
            .select({ id: coveredPeriods.id })
            .from(coveredPeriods)
            .where(
                and(
                    eq(coveredPeriods.subscriptionId, input.subscriptionId),
                    eq(coveredPeriods.periodStart, periodStart),
                    isNull(coveredPeriods.releasedAt)
                )
            )
            .limit(1);
        return Boolean(covered);
    };
    if (!(await conflict(candidate.periodStart))) return candidate;
    if (candidate.reimputedFrom && !(await conflict(input.originalPeriodStart)))
        return {
            periodStart: input.originalPeriodStart,
            reimputedFrom: null,
            nextChargeAt: candidateManualPaymentPeriod({
                ...input,
                now: input.originalPeriodStart
            }).nextChargeAt
        };
    reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_COVERAGE_CONFLICT');
}

/** Read-only MP4 preview with the registration's business rejections. */
export async function previewLateManualPaymentRegistration(input: Input): Promise<{
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly reimputedPeriodStart: Date | null;
    readonly nextChargeAt: Date;
    readonly effect: 'S7' | 'S19';
}> {
    const parsed = inputSchema.parse(input);
    const now = new Date();
    return getDb().transaction(async (tx) => {
        const checked = await check({ ...parsed, actor: input.actor }, tx, false);
        const conditions = await checkLatePaymentConditions(lateConditionsInput(checked, tx));
        if (!('retainedForS19' in conditions) && !conditions.ok)
            reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_CONDITION_FAILED');
        const effect = 'retainedForS19' in conditions ? 'S19' : 'S7';
        const period =
            effect === 'S19'
                ? candidateManualPaymentPeriod({
                      originalPeriodStart: checked.installment.periodStart,
                      everyMonths: checked.everyMonths,
                      now: checked.installment.periodStart
                  })
                : await previewPeriod({
                      tx,
                      subscriptionId: checked.subscription.id,
                      originalPeriodStart: checked.installment.periodStart,
                      everyMonths: checked.everyMonths,
                      now
                  });
        return {
            subscriptionId: checked.subscription.id,
            manualPaymentId: checked.installment.id,
            periodStart: checked.installment.periodStart,
            reimputedPeriodStart: period.reimputedFrom ? period.periodStart : null,
            nextChargeAt: period.nextChargeAt,
            effect
        };
    });
}

/** MP4 registers a late installment and reactivates S7 or retains it for S19 atomically. */
export async function registerLateManualPayment(
    input: Input,
    ports: RegisterLateManualPaymentPorts
): Promise<{
    readonly effect: 'S7' | 'S19';
    readonly nextChargeAt: Date;
    readonly periodStart: Date;
    readonly reimputedFrom: Date | null;
    readonly receiptId: string | null;
}> {
    const parsed = inputSchema.parse(input);
    const now = ports.clock.now();
    const committed = await getDb().transaction(async (tx) => {
        const checked = await check({ ...parsed, actor: input.actor }, tx, true);
        const { subscription, installment, everyMonths } = checked;
        const conditions = await checkLatePaymentConditions(lateConditionsInput(checked, tx));
        const retainedForS19 = 'retainedForS19' in conditions;
        if (!retainedForS19 && !conditions.ok)
            reject(ServiceErrorCode.ALREADY_EXISTS, 'MANUAL_PAYMENT_CONDITION_FAILED');
        // S19 has no reactivation instant: it pays the original period, as MP1 does.
        // Both destinations claim C5 through the same SAVEPOINT and conflict fallback.
        const period = await claimManualPaymentPeriod({
            tx,
            subscriptionId: subscription.id,
            manualPaymentId: installment.id,
            originalPeriodStart: installment.periodStart,
            everyMonths,
            now,
            ...(retainedForS19 ? { periodAt: installment.periodStart } : {})
        });
        const registered = await manualPaymentModel.markRegisteredFromDeclaredUnpaid({
            manualPaymentId: installment.id,
            registeredBy: input.actor.id,
            registeredAt: now,
            proofRef: parsed.proofRef,
            ...(period.reimputedFrom ? { periodStart: period.periodStart } : {}),
            tx
        });
        if (!registered) reject(ServiceErrorCode.ALREADY_EXISTS, 'LOST_RACE');
        if (period.reimputedFrom)
            await domainEventModel.insert({
                eventType: 'manual_payment.reimputed',
                entityType: 'manual_payment',
                entityId: installment.id,
                actorType: 'admin',
                actorId: input.actor.id,
                correlationId: crypto.randomUUID(),
                changes: [
                    {
                        field: 'manual_payment.period_start',
                        old: period.reimputedFrom.toISOString(),
                        new: period.periodStart.toISOString()
                    }
                ],
                occurredAt: now,
                tx
            });
        const { payer } = await readReceiptPayer({ tx, userId: subscription.userId });
        const receipt = await issueReceipt({
            tx,
            source: { kind: 'MANUAL_PAYMENT', manualPaymentId: installment.id },
            payer,
            issuedAt: now
        });
        if ('retainedForS19' in conditions) {
            await retainPaymentForSuccession({
                subscriptionId: subscription.id,
                payment: { source: 'MANUAL_PAYMENT', id: installment.id },
                unpaidSince: subscription.graceStartedAt ?? now,
                now,
                tx
            });
            await tx
                .update(subscriptions)
                .set({ nextChargeAt: period.nextChargeAt, updatedAt: now })
                .where(
                    and(
                        eq(subscriptions.id, subscription.id),
                        eq(subscriptions.status, 'SUSPENDED')
                    )
                );
            return {
                subscription,
                result: {
                    effect: 'S19' as const,
                    nextChargeAt: period.nextChargeAt,
                    periodStart: period.periodStart,
                    reimputedFrom: period.reimputedFrom,
                    receiptId: receipt.receiptId
                }
            };
        }
        const [updated] = await tx
            .update(subscriptions)
            .set({
                status: 'ACTIVE',
                nextChargeAt: period.nextChargeAt,
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: now
            })
            .where(
                and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, 'SUSPENDED'))
            )
            .returning({ id: subscriptions.id });
        if (!updated) reject(ServiceErrorCode.ALREADY_EXISTS, 'LOST_RACE');
        await applyOverdueScheduledChangeOnReturn(
            { subscriptionId: subscription.id, now, tx },
            {
                scheduledChangeApplier:
                    ports.scheduledChangeApplier ?? unimplementedScheduledChangeApplier
            }
        );
        return {
            subscription,
            result: {
                effect: 'S7' as const,
                nextChargeAt: period.nextChargeAt,
                periodStart: period.periodStart,
                reimputedFrom: period.reimputedFrom,
                receiptId: receipt.receiptId
            }
        };
    });
    logger.info(
        {
            subscriptionId: committed.subscription.id,
            manualPaymentId: parsed.manualPaymentId,
            effect: committed.result.effect,
            reimputedFrom: committed.result.reimputedFrom?.toISOString() ?? null,
            periodStart: committed.result.periodStart.toISOString()
        },
        'Late manual payment registered'
    );
    if (committed.result.effect === 'S7') {
        await emitAddedAfterCommit({
            subscriptionId: committed.subscription.id,
            userId: committed.subscription.userId,
            vertical: committed.subscription.vertical,
            coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
        });
        if (ports.complementPorts) {
            const postCommitPorts = {
                ...ports.complementPorts,
                clock: ports.clock,
                coverageNotices: ports.coverageNotices,
                billingFacts: ports.billingFacts
            };
            await cancelInheritedTouristVipAfterCommit({
                subscriptionId: committed.subscription.id,
                userId: committed.subscription.userId,
                ports: postCommitPorts
            });
            if (ports.complementPorts.complements)
                try {
                    await resumeComplementsS33(
                        {
                            principalSubscriptionId: committed.subscription.id,
                            trigger: 'PRINCIPAL_ACTIVE'
                        },
                        {
                            provider: ports.complementPorts.provider,
                            clock: ports.clock,
                            policy: ports.complementPorts.complements
                        }
                    );
                } catch (error) {
                    logger.error(
                        { subscriptionId: committed.subscription.id, error },
                        'S33 failed after MP4 commit'
                    );
                }
        }
    }
    return committed.result;
}
