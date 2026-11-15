import {
    addonInstances,
    addonVersions,
    and,
    billingOptions,
    type COURTESY_CLOSE_REASONS,
    courtesyGrants,
    type DrizzleClient,
    eq,
    gt,
    inArray,
    isNull,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import { computeCourtesyBalanceMonths } from './courtesy-balance';
import {
    findOpenRetentionsBySubscription,
    releaseRetainedPayment
} from './succession-retained-payment';

const linksSchema = z.strictObject({
    predecessorId: z.uuid(),
    successorId: z.uuid(),
    now: z.date()
});

/** AC:B8b:10: link the dead predecessor to its live successor inside the caller's transaction. */
export async function linkClosedPredecessor(input: {
    readonly predecessorId: string;
    readonly successorId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<void> {
    const value = linksSchema.parse({
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        now: input.now
    });
    await input.tx
        .update(subscriptions)
        .set({ succeededById: value.successorId, updatedAt: value.now })
        .where(eq(subscriptions.id, value.predecessorId));
}

/** AC:B8b:10: remove the successor's predecessor reference after the predecessor is dead. */
export async function clearSuccessorLink(input: {
    readonly predecessorId: string;
    readonly successorId: string;
    readonly now: Date;
    readonly successorStatus: string;
    readonly tx: DrizzleClient;
}): Promise<void> {
    const value = linksSchema.extend({ successorStatus: z.string().min(1) }).parse({
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        now: input.now,
        successorStatus: input.successorStatus
    });
    const rows = await input.tx
        .update(subscriptions)
        .set({ succeedsId: null, updatedAt: value.now })
        .where(
            and(
                eq(subscriptions.id, value.successorId),
                eq(subscriptions.succeedsId, value.predecessorId),
                eq(subscriptions.status, value.successorStatus)
            )
        )
        .returning({ id: subscriptions.id });
    if (rows.length !== 1)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession successor link changed during close',
            undefined,
            'SUCCESSION_CLOSE_LINK_MOVED'
        );
}

/** AC:B8b:10: move only vertically scoped complements; the promo redemption stays put. */
export async function repointComplements(input: {
    readonly predecessorId: string;
    readonly successorId: string;
    readonly tx: DrizzleClient;
}): Promise<number> {
    const { predecessorId, successorId } = z
        .strictObject({ predecessorId: z.uuid(), successorId: z.uuid() })
        .parse({ predecessorId: input.predecessorId, successorId: input.successorId });
    const rows = await input.tx
        .update(addonInstances)
        .set({ targetId: successorId })
        .where(
            and(
                eq(addonInstances.targetId, predecessorId),
                inArray(
                    addonInstances.addonVersionId,
                    input.tx
                        .select({ id: addonVersions.id })
                        .from(addonVersions)
                        .where(eq(addonVersions.scopeType, 'VERTICAL_SUBSCRIPTION'))
                )
            )
        )
        .returning({ id: addonInstances.id });
    return rows.length;
}

/** AC:B8b:10 and DEC-GRANT-007: leave a monthly courtesy deferred for S9, or close its balance on a nonmonthly target. */
export async function deferOrCloseCourtesy(input: {
    readonly predecessorId: string;
    readonly successorBillingOptionId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
}): Promise<'DEFERRED' | 'CLOSED_NON_MONTHLY' | 'NONE'> {
    const value = z
        .strictObject({
            predecessorId: z.uuid(),
            successorBillingOptionId: z.uuid(),
            now: z.date()
        })
        .parse({
            predecessorId: input.predecessorId,
            successorBillingOptionId: input.successorBillingOptionId,
            now: input.now
        });
    const [option] = await input.tx
        .select({ cycle: billingOptions.cycle })
        .from(billingOptions)
        .where(eq(billingOptions.id, value.successorBillingOptionId))
        .limit(1);
    if (!option)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Succession billing option missing',
            undefined,
            'SUCCESSION_CLOSE_BILLING_OPTION_MISSING'
        );
    const grants = await input.tx
        .select({
            id: courtesyGrants.id,
            startsAt: courtesyGrants.startsAt,
            endsAt: courtesyGrants.endsAt
        })
        .from(courtesyGrants)
        .where(
            and(
                eq(courtesyGrants.subscriptionId, value.predecessorId),
                isNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt),
                gt(courtesyGrants.endsAt, value.now)
            )
        );
    for (const grant of grants) {
        const { months } = computeCourtesyBalanceMonths({
            startsAt: grant.startsAt,
            endsAt: grant.endsAt,
            now: value.now
        });
        if (option.cycle === 'monthly') {
            await input.tx
                .update(courtesyGrants)
                .set({ balanceMonths: months })
                .where(eq(courtesyGrants.id, grant.id));
        } else {
            await input.tx
                .update(courtesyGrants)
                .set({
                    balanceMonths: months,
                    balanceClosedAt: value.now,
                    closeReason:
                        'DESTINO_DE_PLAN_NO_MENSUAL' satisfies (typeof COURTESY_CLOSE_REASONS)[number]
                })
                .where(eq(courtesyGrants.id, grant.id));
        }
    }
    return grants.length === 0
        ? 'NONE'
        : option.cycle === 'monthly'
          ? 'DEFERRED'
          : 'CLOSED_NON_MONTHLY';
}

/** AC:B8b:10 and MOT:1: mark each open S19 payment and release its retention in the same transaction. */
export async function flagRetainedPayments(input: {
    readonly predecessorId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
    readonly markPayments?: ReconciliationMarkPayments;
}): Promise<number> {
    const value = z
        .strictObject({ predecessorId: z.uuid(), now: z.date() })
        .parse({ predecessorId: input.predecessorId, now: input.now });
    const retentions = await findOpenRetentionsBySubscription({
        subscriptionId: value.predecessorId,
        tx: input.tx
    });
    let opened = 0;
    for (const retention of retentions) {
        if (retention.manualPaymentId)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Manual succession retention has no defined credit path',
                undefined,
                'SUCCESSION_MANUAL_RETENTION_UNSUPPORTED'
            );
        if (!retention.paymentId)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Succession retention has no payment',
                undefined,
                'SUCCESSION_RETENTION_PAYMENT_MISSING'
            );
        const mark = await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId: value.predecessorId },
                reason: 'REEMBOLSO_POR_CONFIRMAR',
                payment: { source: 'PAYMENT', id: retention.paymentId },
                actor: { type: 'job' },
                correlationId: retention.id,
                tx: input.tx
            },
            { markPayments: input.markPayments }
        );
        if (mark.outcome === 'OPENED') opened++;
        await releaseRetainedPayment({
            paymentId: retention.paymentId,
            reason: 'SUCCESSION_CLOSED',
            now: value.now,
            tx: input.tx
        });
    }
    return opened;
}
