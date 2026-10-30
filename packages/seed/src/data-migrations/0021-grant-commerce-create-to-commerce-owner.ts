/**
 * @fileoverview
 * Data migration: 0021-grant-commerce-create-to-commerce-owner
 *
 * Grants `COMMERCE_CREATE` to the `COMMERCE_OWNER` role's `role_permission`
 * row, mirroring the baseline assignment now made in
 * `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * ## Background (HOS-166 PR-A)
 *
 * `COMMERCE_OWNER` previously carried only `COMMERCE_EDIT_OWN` — enough to
 * edit an existing listing, but not to create one. HOS-166 moves listing
 * creation from admin-driven to owner self-service, so the role needs
 * `COMMERCE_CREATE` too. Per the project's seed dual-write rule (CLAUDE.md —
 * role→permission grants are seed DATA already present on live
 * environments), editing only the baseline `rolePermissions.seed.ts` file is
 * not enough: an already-seeded staging/prod database never re-runs the
 * `required` seed baseline, so it would never receive this new
 * `role_permission` row without this migration.
 *
 * Idempotent via `onConflictDoNothing` on the table's `(role, permission)`
 * composite primary key — safe to re-run (mirrors
 * `0014-hos-43-occupancy-permissions.ts`).
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS a grant (an `INSERT ... ON CONFLICT DO
 * NOTHING`). It never deletes or narrows access, so the production
 * destructive-migration gate does not apply.
 *
 * ## Retired by HOS-1417
 *
 * The `COMMERCE_OWNER` role and every `commerce.*` permission were retired by
 * migration 0126 (HOS-1417), which deletes their `role_permission` rows. Data
 * migrations always run after the schema carril, so wherever this one has not
 * run yet `role_enum` no longer has the value and inserting it would make
 * Postgres reject the query. The end state 0126 leaves — no such grant — is
 * already the correct one, so `up()` is a no-op that keeps its ledger key.
 */
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0021-grant-commerce-create-to-commerce-owner',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(_ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return {
        summary:
            'No-op: COMMERCE_OWNER and commerce.create were retired by migration 0126 (HOS-1417).',
        counts: { granted: 0, alreadyPresent: 0 }
    };
}
