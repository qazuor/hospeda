import {
    and,
    desc,
    eq,
    getDb,
    inArray,
    manualPayments,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { createCutExpectedAmountPolicy } from '@repo/service-core';
import { getClock } from '../../utils/clock';

const logger = createLogger('read-own-manual-installments');

/** Resolve the due date for a manual installment's supported open state. */
export function resolveManualInstallmentDueAt(input: {
    readonly status: string;
    readonly authorizationWindowEndsAt: Date | null;
    readonly graceEndsAt: Date | null;
}): Date | null {
    if (input.status === 'PENDING_AUTHORIZATION') return input.authorizationWindowEndsAt;
    if (input.status === 'GRACE_PERIOD') return input.graceEndsAt;
    return null;
}

/** Whether an open installment remains within its payment window. */
export function isManualInstallmentShown(input: {
    readonly dueAt: Date | null;
    readonly now: Date;
}): boolean {
    return input.dueAt !== null && input.dueAt > input.now;
}

/** Read one future open manual installment per principal subscription owned by the caller. */
export async function readOwnManualInstallments(userId: string) {
    const rows = await getDb()
        .select({
            subscription: subscriptions,
            manualPaymentId: manualPayments.id,
            periodStart: manualPayments.periodStart,
            planSlug: plans.slug,
            planName: plans.name
        })
        .from(subscriptions)
        .innerJoin(
            manualPayments,
            and(
                eq(manualPayments.subscriptionId, subscriptions.id),
                eq(manualPayments.status, 'AWAITING'),
                eq(manualPayments.entry, 'INSTALLMENT')
            )
        )
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.paymentMethod, 'MANUAL'),
                inArray(subscriptions.status, ['PENDING_AUTHORIZATION', 'GRACE_PERIOD'])
            )
        )
        .orderBy(desc(manualPayments.periodStart));
    const now = getClock().clock.now();
    const policy = createCutExpectedAmountPolicy();
    const seen = new Set<string>();
    const installments = [];
    for (const row of rows) {
        if (seen.has(row.subscription.id)) continue;
        seen.add(row.subscription.id);
        const dueAt = resolveManualInstallmentDueAt({
            status: row.subscription.status,
            authorizationWindowEndsAt: row.subscription.authorizationWindowEndsAt,
            graceEndsAt: row.subscription.graceEndsAt
        });
        if (!isManualInstallmentShown({ dueAt, now })) continue;
        const expected = await policy.expectedAmount({
            subscription: row.subscription,
            purpose: { kind: 'PERIOD', chargeCreatedAt: row.periodStart }
        });
        let amount: { amountMinor: number; currency: 'ARS' } | null = null;
        if (expected.kind === 'NOT_COMPARABLE') {
            logger.warn(
                { subscriptionId: row.subscription.id, reason: expected.reason },
                'Could not calculate manual installment amount'
            );
        } else if (expected.currency === 'ARS') {
            amount = { amountMinor: expected.amountMinor, currency: 'ARS' };
        } else {
            logger.warn(
                { subscriptionId: row.subscription.id, currency: expected.currency },
                'Manual installment currency is not supported'
            );
        }
        installments.push({
            subscriptionId: row.subscription.id,
            manualPaymentId: row.manualPaymentId,
            vertical: row.subscription.vertical,
            plan: { slug: row.planSlug, name: row.planName },
            amount,
            periodStart: row.periodStart.toISOString(),
            dueAt: dueAt.toISOString()
        });
    }
    return installments;
}
