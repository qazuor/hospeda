/**
 * @fileoverview
 * Data migration: 0052-hos-301-deactivate-tourist-plus
 *
 * Deactivates the `tourist-plus` plan (HOS-301 D1, owner-confirmed
 * 2026-08-11): the tourist tier ships with a single paid plan, `tourist-vip`.
 *
 * ## Deactivated, not deleted
 *
 * Owner decision: give `tourist-plus` the same treatment the `complex-*` plans
 * got in `0003-hos16-deactivate-complex-plans.ts`, whose shape this migration
 * follows. The plan definition stays in `ALL_PLANS` and the row stays in
 * `billing_plans`, so:
 *
 * - `GET /api/v1/public/plans` stops advertising it (the route filters on
 *   `active = true`), which is the entire visible effect;
 * - any existing subscription on it keeps resolving its entitlements normally,
 *   instead of dangling against a deleted plan;
 * - reversing the decision is a one-line `UPDATE ... SET active = true`.
 *
 * ## Why this migration exists (Model C)
 *
 * `active` is classified `'commercial'` in
 * `packages/billing/src/config/model-c-field-split.ts` — the seeder never
 * overwrites it once the row exists, so flipping `isActive: false` in
 * `plans.config.ts` corrects only a fresh `db:fresh`/`db:fresh-dev`. Fresh
 * environments get `active = false` straight from the seeder's INSERT; already
 * seeded ones need this explicit UPDATE.
 *
 * ## Idempotency
 *
 * Guarded `WHERE active = true`, so a second run matches zero rows. Note the
 * same caveat `0003` documents: the guard is "this plan, while active", not
 * "never touched again" — but the runner's ledger means an applied migration
 * never re-runs, so a later manual re-activation cannot be undone by this file.
 *
 * ## `destructive` flag decision
 *
 * `false`, for the same reasons as `0003`: a boolean flip on a single row, with
 * a documented one-line manual reversal and no deletes.
 */
import { and, billingPlans, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0052-hos-301-deactivate-tourist-plus',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The plan row this migration targets (`billing_plans.name` = the slug). */
const TOURIST_PLUS_SLUG = 'tourist-plus';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(billingPlans.name, TOURIST_PLUS_SLUG), eq(billingPlans.active, true)))
        .returning({ id: billingPlans.id });

    return {
        summary:
            updated.length === 0
                ? `Plan "${TOURIST_PLUS_SLUG}" is absent or already inactive — nothing to update.`
                : `Deactivated "${TOURIST_PLUS_SLUG}" (${updated.length} row).`,
        counts: { planRowsUpdated: updated.length }
    };
}
