/**
 * @fileoverview
 * Data migration: 0003-hos16-deactivate-complex-plans
 *
 * Ports `packages/db/src/migrations/extras/025-hos16-deactivate-complex-plans.plan.sql`
 * (HOS-16 — Plan Packaging Recalibration) into the versioned seed
 * data-migration carril (HOS-25, T-020).
 *
 * The complex/multi-property vertical is not implemented yet, but its 3
 * plans (`complex-basico`, `complex-pro`, `complex-premium`) were active and
 * partly exposed anyway. This migration deactivates them on existing
 * environments so `GET /api/v1/public/plans` (which filters on
 * `active = true`) stops advertising a product that can't be sold.
 *
 * `active` is classified `'commercial'` in Model C
 * (`packages/billing/src/config/model-c-field-split.ts`) — the seeder never
 * overwrites it once a row exists, so the config-level `isActive: false` flip
 * in `packages/billing/src/config/plans.config.ts` does NOT propagate to
 * already-seeded rows on staging/prod. This one-off UPDATE is the explicit,
 * auditable way to apply it there. Fresh environments get the correct
 * `active = false` directly from the seeder on first insert.
 *
 * Reversible: re-activate any of these 3 plans at any time with a manual
 * `UPDATE billing_plans SET active = true WHERE name = '<slug>'` once the
 * complex vertical ships (tracked separately, not part of HOS-16).
 *
 * ## `destructive` flag decision (T-020)
 *
 * Set to `false`. This migration flips a boolean column on existing rows —
 * it does not `DELETE` anything, and running it twice is a true no-op (the
 * `WHERE active = true` guard means the second run matches zero rows). The
 * runner's production safety gate (T-011, `evaluateProdDataMigrationGate`)
 * reserves `destructive: true` for migrations that delete or otherwise
 * irreversibly mutate rows without an operator-visible recovery path. A
 * boolean flip that is explicitly documented as reversible via a one-line
 * manual `UPDATE` (see above) does not meet that bar, even though it is a
 * meaningful state change for the 3 affected plans. If this migration is
 * ever extended to touch a wider or less-reversible set of rows, revisit
 * this classification.
 *
 * Note (same caveat the original `.plan.sql` documented): the guard is
 * "only these 3 named plans, never active", not "never touched again" — a
 * manual re-activation of one of these plans WOULD be re-deactivated by a
 * second run of this migration, since the ledger only records that this
 * migration ran ONCE, ever (the runner never re-runs an applied migration —
 * see `runner.ts`'s ledger check). So in practice this is a true one-shot,
 * and the "re-run re-deactivates" caveat only matters for the (already
 * superseded) `.plan.sql` file's own re-apply-via-`db:apply-extras` model,
 * not for this ported version.
 *
 * As with the other two ported migrations, the defensive
 * `information_schema.tables` existence check from the original `.plan.sql`
 * is omitted here: the seed data-migration runner only runs after the
 * structural migration that creates `billing_plans` has already applied.
 */
import { and, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0003-hos16-deactivate-complex-plans',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const COMPLEX_PLAN_NAMES = ['complex-basico', 'complex-pro', 'complex-premium'] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({ active: false, updatedAt: new Date() })
        .where(
            and(inArray(billingPlans.name, [...COMPLEX_PLAN_NAMES]), eq(billingPlans.active, true))
        )
        .returning({ id: billingPlans.id });

    const deactivatedRows = updated.length;

    return {
        summary: `Deactivated ${deactivatedRows} complex plan row(s).`,
        counts: { deactivatedRows }
    };
}
