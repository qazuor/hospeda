import { and, billingOptions, type DrizzleClient, eq, getDb } from '@repo/db';
import type { PlanMigrationReason } from '@repo/schemas';
import { readLivePromos } from '../promo/live-promos.js';
import { composePromoAmount } from '../promo/promo-composition.js';
import { planMigrationRejection } from './plan-migration-authorization.js';
import type { PlanMigrationCohortRow } from './plan-migration-cohort.js';

/**
 * Read the same live promotional price and destination price for preview and notices.
 *
 * A retirement drops the live promo and shows the destination list price. A price
 * increase keeps the live promo applied over the new list price — the same amount
 * the expected-amount policy computes for `MIGRATION_DECIDED` rows.
 */
export async function planMigrationRowPricing(args: {
    readonly tx?: DrizzleClient;
    readonly row: PlanMigrationCohortRow;
    readonly targetPlanVersionId: string;
    readonly at: Date;
    readonly reason?: PlanMigrationReason;
}): Promise<{
    readonly currentAmount: number;
    readonly newAmount: number | null;
    readonly currency: string;
    readonly losesPromo: boolean;
}> {
    const db = args.tx ?? getDb();
    const [option] = await db
        .select({ amount: billingOptions.amount, currency: billingOptions.currency })
        .from(billingOptions)
        .where(eq(billingOptions.id, args.row.billingOptionId))
        .limit(1);
    if (!option)
        throw planMigrationRejection({
            reason: 'INVALID_PLAN_MIGRATION_INPUT',
            message: 'Anchored billing option is missing.'
        });
    const [targetOption] = await db
        .select({ amount: billingOptions.amount })
        .from(billingOptions)
        .where(
            and(
                eq(billingOptions.planVersionId, args.targetPlanVersionId),
                eq(billingOptions.cycle, args.row.cycle)
            )
        )
        .limit(1);
    const promos = await readLivePromos({
        subscriptionId: args.row.subscriptionId,
        at: args.at,
        executor: db
    });
    const composedPromos = promos.map(({ discountKind, value }) => ({ discountKind, value }));
    const currentAmount = composePromoAmount({
        listAmountMinor: option.amount,
        promos: composedPromos
    }).amountMinor;
    if (args.reason === 'PRICE_INCREASE') {
        return {
            currentAmount,
            newAmount: targetOption
                ? composePromoAmount({
                      listAmountMinor: targetOption.amount,
                      promos: composedPromos
                  }).amountMinor
                : null,
            currency: option.currency,
            losesPromo: false
        };
    }
    return {
        currentAmount,
        newAmount: targetOption?.amount ?? null,
        currency: option.currency,
        losesPromo: promos.length > 0
    };
}
