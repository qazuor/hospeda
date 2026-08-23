/**
 * @fileoverview
 * Data migration: 0069-hos-733-advanced-stats-premium-only
 *
 * Removes `view_advanced_stats` from the already-seeded `owner-pro` plan so
 * live environments converge with HOS-733's catalog change.
 *
 * ## Why this migration exists (Model C)
 *
 * `entitlements` is classified `'commercial'` in
 * `packages/billing/src/config/model-c-field-split.ts`: once the row exists,
 * the seed sync does NOT overwrite it. Editing `plans.config.ts` alone only
 * fixes a fresh `db:fresh` / `db:fresh-dev`; staging and production would keep
 * granting `view_advanced_stats` to `owner-pro` forever.
 *
 * ## Scope
 *
 * Only the `owner-pro` row is touched. `billing_plans.name` stores the plan
 * slug (`owner-pro`), while the human label (`Professional`) lives in
 * `display_name` / `metadata.displayName`, so this migration matches the slug
 * carrier directly.
 *
 * `owner-premium` deliberately keeps the entitlement, and the inactive
 * `complex-*` plans stay out of scope so the migration mirrors the exact code
 * change in this PR.
 *
 * ## Idempotency
 *
 * The `WHERE` clause matches only when the `owner-pro` row STILL contains
 * `view_advanced_stats`, so a second run updates zero rows.
 *
 * ## `destructive` flag decision
 *
 * `false`. This is a guarded one-row array edit with a trivial reversal.
 */
import { and, billingPlans, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0069-hos-733-advanced-stats-premium-only',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The `billing_plans.name` slug for the Professional host plan. */
const OWNER_PRO_SLUG = 'owner-pro';

/** The entitlement removed by HOS-733. */
const ADVANCED_STATS_ENTITLEMENT = 'view_advanced_stats';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({
            entitlements: sql`array_remove(${billingPlans.entitlements}, ${ADVANCED_STATS_ENTITLEMENT})`,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingPlans.name, OWNER_PRO_SLUG),
                sql`${ADVANCED_STATS_ENTITLEMENT} = ANY(${billingPlans.entitlements})`
            )
        )
        .returning({ id: billingPlans.id });

    return {
        summary:
            updated.length === 0
                ? `Plan "${OWNER_PRO_SLUG}" already lacked "${ADVANCED_STATS_ENTITLEMENT}" — nothing to update.`
                : `Removed "${ADVANCED_STATS_ENTITLEMENT}" from "${OWNER_PRO_SLUG}" (${updated.length} row).`,
        counts: { planRowsUpdated: updated.length }
    };
}
