/**
 * @fileoverview
 * Data migration: 0045-partner-tier-plans
 *
 * Seeds the two commercial partner tiers — `partner-silver` and `partner-gold`
 * — with their monthly and annual ARS prices (HOS-278 D4, §6.3).
 *
 * ## Why this migration exists
 *
 * The dual-write rule. Adding the plans to `plans.config.ts` alone corrects
 * only a FRESH `db:fresh` run: `seedPartnerPlan` INSERTs a plan row only when
 * one does not already exist, so an already-seeded environment (staging, prod)
 * would never receive the two new tiers. Without this, every partner on those
 * environments stays stuck on the single flat `partner-listing` plan and there
 * is nothing for the tier map to resolve to.
 *
 * ## What it creates
 *
 * Per tier, three rows, each guarded so a second run is a no-op:
 *
 * 1. `billing_plans` — matched by `name = <slug>`, stamped
 *    `product_domain='partner'` so it never leaks into the accommodation
 *    pricing surfaces (`GET /public/plans` filters on that column).
 * 2. `billing_prices` monthly — `ARS`, `billingInterval='month'`,
 *    `intervalCount=1`.
 * 3. `billing_prices` annual — same tuple at `'year'`.
 *
 * ## Prices
 *
 * Silver ARS 15,000/month, gold ARS 30,000/month (owner, 2026-08-06). The
 * annual amounts are DERIVED, not separately decided: every plan in
 * `plans.config.ts` prices a year at ten months ("2 months free", 16.67% off),
 * so silver is 150,000 and gold 300,000. The literals live in
 * `PARTNER_SILVER_PLAN`/`PARTNER_GOLD_PLAN` and are read from there rather
 * than repeated here — a migration that hardcoded them would drift from the
 * baseline the moment either is repriced.
 *
 * ## Only two cadences
 *
 * §6.3 asks for four. `ensurePrice` hardcodes `intervalCount: 1` and the only
 * lookups downstream are `findMonthlyPrice`/`findAnnualPrice`, so quarterly
 * (`month × 3`) and semiannual (`month × 6`) are not expressible yet. Split out
 * deliberately — see `PARTNER_SILVER_PLAN`'s JSDoc.
 *
 * ## Idempotency
 *
 * Every insert is preceded by a lookup on its natural key, and existing rows
 * are never UPDATEd. Re-running affects zero rows. An operator who repriced a
 * tier through the admin keeps their value — the same Model C rule 0022
 * follows.
 *
 * ## `destructive` flag decision
 *
 * `false`. Inserts only; touches no existing row, deletes nothing.
 * `partner-listing` is deliberately left active and untouched: a live partner
 * may still point `plan_id` at it, and retiring it is a decision about real
 * rows rather than a config edit.
 */

import type { PlanDefinition } from '@repo/billing';
import { PARTNER_GOLD_PLAN, PARTNER_SILVER_PLAN } from '@repo/billing';
import { and, billingPlans, billingPrices, eq } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0045-partner-tier-plans',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Whether this run targets a live environment. See the price insert below. */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** The tiers this migration converges, in display order. */
const TIER_PLANS: readonly PlanDefinition[] = [PARTNER_SILVER_PLAN, PARTNER_GOLD_PLAN];

/**
 * Ensures one price row exists for a plan at a given cadence.
 *
 * @returns 1 when a row was created, 0 when one already existed.
 */
async function ensurePrice({
    ctx,
    planId,
    unitAmount,
    billingInterval
}: {
    readonly ctx: SeedMigrationCtx;
    readonly planId: string;
    readonly unitAmount: number;
    readonly billingInterval: 'month' | 'year';
}): Promise<number> {
    const existing = await ctx.db
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        return 0;
    }

    await ctx.db.insert(billingPrices).values({
        planId,
        currency: 'ARS',
        unitAmount,
        billingInterval,
        intervalCount: 1,
        active: true,
        // Mirrors `seedPartnerPlan`, which stamps this from NODE_ENV. The
        // migration ctx carries no livemode of its own, so reading the same
        // signal the seed reads is what keeps a fresh DB and a migrated one
        // from disagreeing about the flag.
        livemode: IS_PRODUCTION
    });
    return 1;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let plansCreated = 0;
    let pricesCreated = 0;

    for (const plan of TIER_PLANS) {
        const existing = await ctx.db
            .select({ id: billingPlans.id })
            .from(billingPlans)
            .where(eq(billingPlans.name, plan.slug))
            .limit(1);

        let planId = existing[0]?.id;

        if (planId === undefined) {
            const inserted = await ctx.db
                .insert(billingPlans)
                .values({
                    name: plan.slug,
                    description: plan.description,
                    active: plan.isActive,
                    entitlements: plan.entitlements as string[],
                    limits: {},
                    livemode: IS_PRODUCTION,
                    displayName: plan.name,
                    monthlyPriceArs: plan.monthlyPriceArs,
                    annualPriceArs: plan.annualPriceArs,
                    productDomain: ProductDomainEnum.PARTNER,
                    metadata: {
                        slug: plan.slug,
                        displayName: plan.name,
                        category: plan.category,
                        isDefault: plan.isDefault,
                        sortOrder: plan.sortOrder,
                        trialDays: plan.trialDays,
                        hasTrial: plan.hasTrial,
                        monthlyPriceArs: plan.monthlyPriceArs,
                        annualPriceArs: plan.annualPriceArs,
                        monthlyPriceUsdRef: plan.monthlyPriceUsdRef
                    }
                })
                .returning({ id: billingPlans.id });

            const insertedRow = inserted[0];
            if (!insertedRow) {
                throw new Error(`Insert of partner plan "${plan.slug}" returned no row`);
            }
            planId = insertedRow.id;
            plansCreated++;
        }

        pricesCreated += await ensurePrice({
            ctx,
            planId,
            unitAmount: plan.monthlyPriceArs,
            billingInterval: 'month'
        });

        if (plan.annualPriceArs !== null) {
            pricesCreated += await ensurePrice({
                ctx,
                planId,
                unitAmount: plan.annualPriceArs,
                billingInterval: 'year'
            });
        }
    }

    return {
        summary:
            plansCreated === 0 && pricesCreated === 0
                ? 'Partner tier plans already present — nothing to do.'
                : `Created ${plansCreated} partner tier plan(s) and ${pricesCreated} price row(s).`,
        counts: { plansCreated, pricesCreated }
    };
}
