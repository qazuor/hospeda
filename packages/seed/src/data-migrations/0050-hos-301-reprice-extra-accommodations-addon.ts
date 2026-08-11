/**
 * @fileoverview
 * Data migration: 0050-hos-301-reprice-extra-accommodations-addon
 *
 * Raises the `extra-accommodations-5` add-on from ARS $10,000 to ARS $13,000
 * per month (HOS-301 D1, owner-confirmed 2026-08-11).
 *
 * The other four add-ons are deliberately untouched: D1 only repriced this one,
 * and `extra-photos-20` / `extra-properties-5` / the two visibility boosts are
 * separate products.
 *
 * ## Why this migration exists (Model C)
 *
 * Add-on pricing is commercial data: `billingAddons.seed.ts`'s `ensureAddon()`
 * INSERTs a row only when one does not already exist (`status: 'skipped'`
 * otherwise) and never updates an existing row's `unitAmount`. So raising
 * `EXTRA_ACCOMMODATIONS_ADDON.priceArs` in `addons.config.ts` alone corrects
 * only a fresh `db:fresh`/`db:fresh-dev`; every already-seeded environment
 * keeps charging $10,000 forever without this explicit UPDATE. Same reasoning
 * as `0049-hos-301-reprice-owner-plans.ts` and
 * `0022-raise-commerce-listing-price-to-15000.ts`.
 *
 * ## What it updates
 *
 * One column: `billing_addons.unitAmount`, the single carrier for an add-on's
 * price (`addon-catalog.mapper.ts` maps `priceArs ← row.unitAmount`).
 *
 * Note there is NO annual carrier to update. `mapRowToAddonDefinition()`
 * hardcodes `annualPriceArs: null` for every add-on, so the config's
 * `annualPriceArs` never reaches the DB or any consumer — it exists only to
 * satisfy `config-validator.ts`, which requires a positive value on recurring
 * add-ons. The D1 annual figure ($130,000) is recorded in the baseline config
 * for that reason alone.
 *
 * ## Row matching
 *
 * Matched on `metadata->>'slug'`, the add-on's stable identifier (the one
 * `mapRowToAddonDefinition()` treats as primary). `billingAddons.seed.ts` uses
 * the display `name` as its idempotency key instead, which would break if the
 * name were ever edited; the slug would not.
 *
 * ## Idempotency
 *
 * The UPDATE is guarded `WHERE unitAmount = 1000000`, so a second run affects
 * zero rows and a price an operator already changed through the admin add-on
 * catalog is left untouched. A missing add-on row is a documented no-op — the
 * baseline (updated in this same PR, per the HOS-25 dual-write rule) seeds it
 * at $13,000 whenever it first runs.
 *
 * ## MercadoPago
 *
 * Out of scope, as in 0049: this moves catalog pricing only. Repricing live
 * subscriptions is HOS-176's flow.
 *
 * ## `destructive` flag decision
 *
 * `false`. One guarded UPDATE on a commercial price column. No deletes.
 */
import { and, billingAddons, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0050-hos-301-reprice-extra-accommodations-addon',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The add-on this migration targets, by its stable `metadata.slug`. */
const ADDON_SLUG = 'extra-accommodations-5';

/** The pre-D1 monthly price, in ARS centavos, this migration replaces. */
const OLD_PRICE_ARS = 1000000;

/** The D1-confirmed monthly price, in ARS centavos. */
const NEW_PRICE_ARS = 1300000;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingAddons)
        .set({ unitAmount: NEW_PRICE_ARS, updatedAt: new Date() })
        .where(
            and(
                sql`${billingAddons.metadata}->>'slug' = ${ADDON_SLUG}`,
                eq(billingAddons.unitAmount, OLD_PRICE_ARS)
            )
        )
        .returning({ id: billingAddons.id });

    return {
        summary:
            updated.length === 0
                ? `Add-on "${ADDON_SLUG}" is absent, already at ${NEW_PRICE_ARS} centavos, or operator-overridden — nothing to update.`
                : `Raised "${ADDON_SLUG}" to ${NEW_PRICE_ARS} centavos on ${updated.length} billing_addons row(s).`,
        counts: { addonRowsUpdated: updated.length }
    };
}
