/**
 * @fileoverview
 * Data migration: 0104-hos-1286-commerce-visibility-boost-addons
 *
 * Inserts the four HOS-1286 commerce visibility boosts
 * (`visibility-boost-gastronomy-7d` / `-30d`,
 * `visibility-boost-experience-7d` / `-30d`) into an ALREADY-SEEDED
 * environment.
 *
 * ## Why this exists (the dual-write rule)
 *
 * `packages/billing/src/config/addons.config.ts` is listed in
 * `BILLING_CONFIG_FILES` in `scripts/check-seed-dual-write.sh`, and the reason
 * is mechanical: `billingAddons.seed.ts` is INSERT-if-absent, matched on the
 * add-on's display `name`. Editing the baseline alone builds a fresh database
 * correctly and leaves staging and production exactly as they were — four
 * add-ons nobody can buy, with the build green throughout. This migration is
 * the other half of that write. `0061-hos-688-commerce-vertical-catalogue` is
 * the precedent this file follows statement for statement.
 *
 * ## Derived from the catalogue, never re-typed here
 *
 * The rows come from `ALL_COMMERCE_VISIBILITY_BOOST_ADDONS`, imported from
 * `@repo/billing`. Nothing about the four add-ons — slug, name, price, duration,
 * entitlement — is spelled out in this file, so the migration cannot drift from
 * the config it exists to propagate. That is the same discipline `0103` applies
 * to the tourist plan slugs.
 *
 * ## Idempotency
 *
 * Matched on `name`, exactly as `ensureAddon` matches. A second run inserts
 * nothing and reports zero. Nothing is UPDATEd, so a price an operator has since
 * changed through the SPEC-168 admin UI survives untouched — `unitAmount` is a
 * `'commercial'` field and the database wins, the same call `0061` made.
 *
 * ## No `billing_prices` rows
 *
 * Unlike `0061`, which inserted a monthly price per enabled plan tier, add-ons
 * carry their amount on the `billing_addons` row itself (`unitAmount`), which is
 * what `addon-catalog.mapper.ts` reads. `billing_prices` is a plan-side table.
 *
 * ## `destructive` flag decision
 *
 * `false`. It only inserts rows that did not exist and deletes nothing.
 */
import { ALL_COMMERCE_VISIBILITY_BOOST_ADDONS } from '@repo/billing';
import { billingAddons, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0104-hos-1286-commerce-visibility-boost-addons',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Inserts any of the four commerce visibility-boost add-ons that the target
 * database does not already have.
 *
 * @param ctx - Runner-supplied context; only `ctx.db` is used.
 * @returns A summary plus the number of add-on rows created.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const db = ctx.db;
    const livemode = process.env.NODE_ENV === 'production';

    let addonsCreated = 0;

    // Column layout mirrors `ensureAddon` in `billingAddons.seed.ts` exactly —
    // `addon-catalog.mapper.ts` reads `metadata.slug` as the primary identifier,
    // so a row written differently here would be invisible to the catalogue.
    for (const addon of ALL_COMMERCE_VISIBILITY_BOOST_ADDONS) {
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
        summary: `HOS-1286 commerce visibility boosts: ${addonsCreated} add-on(s) created`,
        counts: { addonsCreated }
    };
}
