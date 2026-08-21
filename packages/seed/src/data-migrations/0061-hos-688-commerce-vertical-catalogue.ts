/**
 * @fileoverview
 * Data migration: 0061-hos-688-commerce-vertical-catalogue
 *
 * Brings an ALREADY-SEEDED environment up to the HOS-688 §6.8 commerce
 * catalogue: two per-vertical plan families, the two limit definitions their
 * caps refer to, and the two extra-listing add-ons that raise them.
 *
 * ## Why this exists (the dual-write rule)
 *
 * `plans.config.ts`, `limits.config.ts` and `addons.config.ts` are all listed in
 * `BILLING_CONFIG_FILES` in `scripts/check-seed-dual-write.sh`, and for a
 * concrete reason: their seeds are INSERT-if-absent. Editing the baseline alone
 * builds a fresh database correctly and leaves staging and production exactly as
 * they were — a plan nobody can subscribe to, a cap nothing meters and an add-on
 * nobody can buy, with the build green throughout. This migration is the other
 * half of that write.
 *
 * ## What it inserts
 *
 * | Table | Rows | Notes |
 * | --- | --- | --- |
 * | `billing_limits` | `max_gastronomies`, `max_experiences` | Metadata only; the VALUES live on each plan. |
 * | `billing_plans` | the 3 gastronomy + 3 experience tiers | Stamped `product_domain` per vertical, matching `seedCommercePlan`. |
 * | `billing_prices` | one monthly ARS row per ENABLED tier | Only premium is enabled; an unpriced tier gets no price row, because a zero-amount row reads as free rather than as unpriced. |
 * | `billing_addons` | `extra-gastronomies-1`, `extra-experiences-1` | Each `affectsLimitKey` points at its OWN vertical. |
 *
 * The `commerce-listing` plan is left completely untouched. Live subscriptions
 * still point at it, and retiring it is a decision about real rows (HOS-692),
 * not something to fold into a catalogue addition.
 *
 * ## Idempotency
 *
 * Every write is INSERT-if-absent, matched on the same key the corresponding
 * seed matches on — plans by `name` (the slug), add-ons by `name` (the display
 * name), limits by `key`. A second run affects zero rows. Nothing is UPDATEd, so
 * a price or cap an operator has since changed through the admin UI survives
 * untouched: both are `'commercial'` fields and the database wins.
 *
 * ## `destructive` flag decision
 *
 * `false`. It only inserts rows that did not exist, and deletes nothing.
 */
import {
    type AddonDefinition,
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    EXTRA_EXPERIENCES_ADDON,
    EXTRA_GASTRONOMIES_ADDON,
    LIMIT_METADATA,
    LimitKey,
    type PlanDefinition
} from '@repo/billing';
import { and, billingAddons, billingLimits, billingPlans, billingPrices, eq } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0061-hos-688-commerce-vertical-catalogue',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The two limit keys this migration introduces. */
const NEW_LIMIT_KEYS: readonly LimitKey[] = [LimitKey.MAX_GASTRONOMIES, LimitKey.MAX_EXPERIENCES];

/** The plan catalogues to insert, each with the domain to stamp on it. */
const CATALOGUES: ReadonlyArray<{
    plans: readonly PlanDefinition[];
    productDomain: ProductDomainValue;
}> = [
    { plans: ALL_GASTRONOMY_PLANS, productDomain: ProductDomainEnum.GASTRONOMY },
    { plans: ALL_EXPERIENCE_PLANS, productDomain: ProductDomainEnum.EXPERIENCE }
];

/** The two extra-listing add-ons this migration introduces. */
const NEW_ADDONS: readonly AddonDefinition[] = [EXTRA_GASTRONOMIES_ADDON, EXTRA_EXPERIENCES_ADDON];

/**
 * Applies the HOS-688 commerce catalogue to an existing environment.
 *
 * @param ctx - Data-migration context; only `ctx.db` is used.
 * @returns A summary plus per-table creation counters.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const db = ctx.db;
    const livemode = process.env.NODE_ENV === 'production';

    let limitsCreated = 0;
    let plansCreated = 0;
    let pricesCreated = 0;
    let addonsCreated = 0;

    // ── billing_limits ───────────────────────────────────────────────────────
    // Metadata rows only, inserted before the plans because a plan's `limits`
    // JSONB refers to these keys.
    for (const key of NEW_LIMIT_KEYS) {
        const existing = await db
            .select({ key: billingLimits.key })
            .from(billingLimits)
            .where(eq(billingLimits.key, key))
            .limit(1);

        if (existing.length > 0) {
            continue;
        }

        const metadata = LIMIT_METADATA[key];
        await db.insert(billingLimits).values({
            key,
            name: metadata.name,
            description: metadata.description,
            // Same as `billingLimits.seed.ts`: the real value comes from the plan.
            defaultValue: 0
        });
        limitsCreated++;
    }

    // ── billing_plans (+ billing_prices) ─────────────────────────────────────
    for (const { plans, productDomain } of CATALOGUES) {
        for (const plan of plans) {
            const existing = await db
                .select({ id: billingPlans.id })
                .from(billingPlans)
                .where(eq(billingPlans.name, plan.slug))
                .limit(1);

            let planId: string;
            const existingRow = existing[0];

            if (existingRow) {
                planId = existingRow.id;
            } else {
                const limitsObj: Record<string, number> = {};
                for (const l of plan.limits) {
                    limitsObj[l.key] = l.value;
                }

                const inserted = await db
                    .insert(billingPlans)
                    .values({
                        name: plan.slug,
                        description: plan.description,
                        active: plan.isActive,
                        entitlements: plan.entitlements as string[],
                        limits: limitsObj,
                        livemode,
                        displayName: plan.name,
                        monthlyPriceArs: plan.monthlyPriceArs,
                        annualPriceArs: plan.annualPriceArs,
                        productDomain,
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
                    throw new Error(`Insert of commerce plan "${plan.slug}" returned no row`);
                }
                planId = insertedRow.id;
                plansCreated++;
            }

            // An unpriced (disabled) tier gets no price row at all — see the
            // file docblock.
            if (plan.monthlyPriceArs <= 0) {
                continue;
            }

            const existingPrice = await db
                .select({ id: billingPrices.id })
                .from(billingPrices)
                .where(
                    and(
                        eq(billingPrices.planId, planId),
                        eq(billingPrices.currency, 'ARS'),
                        eq(billingPrices.billingInterval, 'month'),
                        eq(billingPrices.intervalCount, 1)
                    )
                )
                .limit(1);

            if (existingPrice.length > 0) {
                continue;
            }

            await db.insert(billingPrices).values({
                planId,
                currency: 'ARS',
                unitAmount: plan.monthlyPriceArs,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode
            });
            pricesCreated++;
        }
    }

    // ── billing_addons ───────────────────────────────────────────────────────
    // Column layout mirrors `ensureAddon` in `billingAddons.seed.ts` exactly —
    // `addon-catalog.mapper.ts` reads `metadata.slug` as the primary identifier,
    // so a row written differently here would be invisible to the catalogue.
    for (const addon of NEW_ADDONS) {
        const existing = await db
            .select({ id: billingAddons.id })
            .from(billingAddons)
            .where(eq(billingAddons.name, addon.name))
            .limit(1);

        if (existing.length > 0) {
            continue;
        }

        await db.insert(billingAddons).values({
            name: addon.name,
            description: addon.description,
            active: addon.isActive,
            unitAmount: addon.priceArs,
            currency: 'ARS',
            billingInterval: addon.billingType === 'one_time' ? 'one_time' : 'month',
            billingIntervalCount: 1,
            entitlements: addon.grantsEntitlement ? [addon.grantsEntitlement] : [],
            limits:
                addon.affectsLimitKey && addon.limitIncrease !== null
                    ? { [addon.affectsLimitKey]: addon.limitIncrease }
                    : {},
            livemode,
            metadata: {
                slug: addon.slug,
                durationDays: addon.durationDays,
                targetCategories: addon.targetCategories,
                sortOrder: addon.sortOrder
            }
        });
        addonsCreated++;
    }

    return {
        summary: `HOS-688 commerce catalogue: ${limitsCreated} limit(s), ${plansCreated} plan(s), ${pricesCreated} price(s), ${addonsCreated} add-on(s) created`,
        counts: { limitsCreated, plansCreated, pricesCreated, addonsCreated }
    };
}
