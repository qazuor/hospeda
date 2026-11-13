import {
    and,
    billingOptions,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    planMigrationSubscriptions,
    planMigrations,
    subscriptions,
    users
} from '@repo/db';
import {
    type BillingCycle,
    BillingCycleSchema,
    type PlanMigrationReason,
    PlanMigrationReasonSchema
} from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { computeApplicationDate } from './plan-migration-application-date.js';
import { planMigrationRowPricing } from './plan-migration-pricing.js';

const inputSchema = z.strictObject({
    subscriptionId: z.uuid(),
    chargeAt: z.date()
});

/** One pending price-increase migration anchored to a subscription's next charge. */
export interface PendingIncreaseAnchor {
    readonly announcedAt: Date;
    readonly noticeDays: number;
    readonly targetPlanVersionId: string;
    readonly subscriptionId: string;
    readonly userId: string;
    readonly customerName: string | null;
    readonly customerEmail: string;
    readonly billingOptionId: string;
    readonly cycle: BillingCycle;
    readonly nextChargeAt: Date | null;
    readonly applicationDate: Date;
    readonly reason: PlanMigrationReason;
}

/**
 * Read the pending migration of one subscription together with its anchored
 * billing option. Both motives answer the lookup: a retirement and a price
 * increase follow the same resume rule. A cancelled or already applied row
 * never answers it.
 */
async function readPendingIncreaseAnchor(args: {
    readonly tx?: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<PendingIncreaseAnchor | null> {
    const db = args.tx ?? getDb();
    const [row] = await db
        .select({
            announcedAt: planMigrations.announcedAt,
            noticeDays: planMigrations.noticeDays,
            targetPlanVersionId: planMigrations.targetPlanVersionId,
            subscriptionId: subscriptions.id,
            userId: users.id,
            customerName: users.displayName,
            customerEmail: users.email,
            billingOptionId: billingOptions.id,
            cycle: billingOptions.cycle,
            nextChargeAt: subscriptions.nextChargeAt,
            applicationDate: planMigrationSubscriptions.applicationDate,
            reason: planMigrations.reason
        })
        .from(planMigrationSubscriptions)
        .innerJoin(
            planMigrations,
            eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
        )
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(
            and(
                eq(planMigrationSubscriptions.subscriptionId, args.subscriptionId),
                eq(planMigrationSubscriptions.status, 'PENDIENTE'),
                isNull(planMigrations.cancelledAt)
            )
        )
        .limit(1);
    if (!row) return null;
    return {
        ...row,
        cycle: BillingCycleSchema.parse(row.cycle),
        reason: PlanMigrationReasonSchema.parse(row.reason)
    };
}

/**
 * Readers of the pending price-increase lookup, exported so a unit test can
 * exercise the day comparison without a database.
 */
export const pendingIncreaseOnResumeReaders = {
    readAnchor: readPendingIncreaseAnchor,
    priceRow: planMigrationRowPricing
};

/**
 * AC:B8b:4 and Q-3: the amount the resumed first charge is billed when that
 * charge is exactly the migration's application day. Both motives apply: an
 * increase reports the discounted destination and a retirement reports the
 * destination list price, because a retirement drops the live promo.
 *
 * The application day is the one `applyPlanMigrationUpcomingNotice` writes and
 * `S37` checks: the first local charge day strictly after the notice and not
 * before the stored application date. When the resumed charge is not that day,
 * an early return `null` keeps the anchored amount, because the migration still
 * waits for a later cycle.
 *
 * @param input.subscriptionId - The principal subscription being resumed
 * @param input.chargeAt - The next charge the resume just wrote
 * @param input.tx - Optional transaction that must see the migration rows
 * @returns The new amount and its currency, or `null` when this charge is not the increase's day
 */
export async function pendingIncreaseAmountForCharge(input: {
    readonly tx?: DrizzleClient;
    readonly subscriptionId: string;
    readonly chargeAt: Date;
}): Promise<{ readonly amountMinor: number; readonly currency: string } | null> {
    const parsed = inputSchema.parse({
        subscriptionId: input.subscriptionId,
        chargeAt: input.chargeAt
    });
    const anchor = await pendingIncreaseOnResumeReaders.readAnchor({
        ...(input.tx ? { tx: input.tx } : {}),
        subscriptionId: parsed.subscriptionId
    });
    if (!anchor) return null;
    const stored = getLocalDateString({ instant: anchor.applicationDate });
    // Same rule as applyPlanMigrationUpcomingNotice: the stored date is a floor that only lands on a charge day (HOS-2108).
    const applicationDay = computeApplicationDate({
        nextChargeAt: parsed.chargeAt,
        cycle: anchor.cycle,
        announcedAt: anchor.announcedAt,
        noticeDays: anchor.noticeDays,
        notBefore: stored
    });
    if (applicationDay !== getLocalDateString({ instant: parsed.chargeAt })) return null;
    const pricing = await pendingIncreaseOnResumeReaders.priceRow({
        ...(input.tx ? { tx: input.tx } : {}),
        row: {
            subscriptionId: anchor.subscriptionId,
            userId: anchor.userId,
            customerName: anchor.customerName,
            customerEmail: anchor.customerEmail,
            billingOptionId: anchor.billingOptionId,
            cycle: anchor.cycle,
            nextChargeAt: anchor.nextChargeAt,
            status: 'ACTIVE',
            alreadyInMigration: true
        },
        targetPlanVersionId: anchor.targetPlanVersionId,
        at: parsed.chargeAt,
        reason: anchor.reason
    });
    if (pricing.newAmount === null) return null;
    return { amountMinor: pricing.newAmount, currency: pricing.currency };
}
