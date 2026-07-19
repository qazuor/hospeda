/**
 * @fileoverview
 * Data migration: 0017-hos-210-tourist-plan-trial
 *
 * Dual-write counterpart (HOS-25) for the HOS-210 baseline change: the two
 * self-service tourist plans `tourist-plus` and `tourist-vip` now get the same
 * 14-day card-first trial as owner plans (`hasTrial: true`, `trialDays: 14`)
 * instead of no trial at all (`hasTrial: false`, `trialDays: 0`).
 *
 * ## Why this migration exists
 *
 * During the SMOKE-19-07 session the owner decided all self-service tourist
 * plans get a 14-day card-first trial. To unblock the live smoke, the change
 * was applied by a MANUAL `UPDATE` to PROD `billing_plans.metadata` only, so it
 * lived nowhere in the repo: the baseline was untouched (a fresh `db:fresh-dev`
 * would build both plans with NO trial) and staging's rows were never updated.
 *
 * `metadata.hasTrial` / `metadata.trialDays` are both classified `'commercial'`
 * in Model C (`packages/billing/src/config/model-c-field-split.ts`) — the admin
 * `PlanDialog.tsx` (SPEC-168) lets operators edit a plan's trial settings, so DB
 * wins once a row exists. Editing the baseline config (`TOURIST_PLUS_PLAN` /
 * `TOURIST_VIP_PLAN` in `packages/billing/src/config/plans.config.ts`) alone
 * only reaches a FRESH seed; already-seeded staging rows need this explicit
 * UPDATE. On PROD this is a no-op re-affirmation (the manual UPDATE already set
 * the same values), which is exactly the idempotent behavior we want.
 *
 * ## OR-PRESERVE semantics
 *
 * The UPDATE only fires for a row whose `metadata.hasTrial` / `metadata.trialDays`
 * are STILL the exact old baseline default (`false` / `0`, including a legacy row
 * that predates either key entirely, via `COALESCE`). If an operator has already
 * changed either field through the admin plan editor, this migration leaves that
 * value alone — it never clobbers a deliberate operator edit, mirroring the guard
 * `0006-owner-test-daily-trial` uses for the same two JSONB metadata keys. This
 * also means the PROD rows already set to `true` / `14` are correctly skipped.
 *
 * Re-running `up()` against an already-migrated database is always a no-op (zero
 * affected rows) once both keys read `true` / `14`, or once an operator has moved
 * either key off the old default — same shape as every other migration here.
 *
 * ## `destructive` flag decision
 *
 * Set to `false`. This migration only flips two JSONB metadata keys on two
 * well-identified plan rows from a known old default to a known new default — it
 * never deletes anything, and the change is trivially reversible via a one-line
 * manual `UPDATE billing_plans SET metadata = metadata ||
 * '{"hasTrial":false,"trialDays":0}'::jsonb WHERE name IN ('tourist-plus','tourist-vip')`.
 */
import { and, billingPlans, inArray, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0017-hos-210-tourist-plan-trial',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The plan rows this migration targets (`billing_plans.name` = the slug). */
const PLAN_NAMES = ['tourist-plus', 'tourist-vip'] as const;

/** New trial config (matches `TOURIST_PLUS_PLAN` / `TOURIST_VIP_PLAN` post-HOS-210). */
const NEW_HAS_TRIAL = true;
const NEW_TRIAL_DAYS = 14;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('hasTrial', ${NEW_HAS_TRIAL}::boolean, 'trialDays', ${NEW_TRIAL_DAYS}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...PLAN_NAMES]),
                // OR-PRESERVE: only touch a row still at the old baseline default
                // (COALESCE covers a legacy row missing either key entirely).
                sql`COALESCE((${billingPlans.metadata}->>'hasTrial')::boolean, false) = false`,
                sql`COALESCE((${billingPlans.metadata}->>'trialDays')::int, 0) = 0`
            )
        )
        .returning({ name: billingPlans.name });

    const rowsUpdated = updated.length;
    const updatedNames = updated.map((row) => row.name).join(', ');

    return {
        summary:
            rowsUpdated === 0
                ? 'tourist-plus/tourist-vip trial already set or operator-edited — no change.'
                : `Set metadata.hasTrial=true, metadata.trialDays=14 on ${rowsUpdated} tourist plan row(s): ${updatedNames}.`,
        counts: { rowsUpdated }
    };
}
