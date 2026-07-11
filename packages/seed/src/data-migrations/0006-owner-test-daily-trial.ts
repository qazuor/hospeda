/**
 * @fileoverview
 * Data migration: 0006-owner-test-daily-trial
 *
 * Dual-write counterpart (HOS-25) for the HOS-110 baseline change: the
 * `owner-test-daily` testing plan (billing-interval-override tooling, see
 * `0004-test-daily-plan`) now gets a **1-day no-card trial**
 * (`hasTrial: true`, `trialDays: 1`) instead of no trial at all
 * (`hasTrial: false`, `trialDays: 0`), so the full trial→expiry cycle
 * (`trialing` subscription created no-card, then the daily
 * `blockExpiredTrials` cron cancels it and fires the TRIAL_EXPIRED
 * notification once the 1-day trial elapses) is exercisable end-to-end on a
 * fast cadence, matching HOS-110 owner decision #2. A no-card trial carries
 * NO MercadoPago preapproval (`mp_subscription_id` stays NULL) — nothing
 * auto-charges when the trial ends; converting to paid is a SEPARATE manual
 * `/start-paid` checkout.
 *
 * `metadata.hasTrial` / `metadata.trialDays` are both classified
 * `'commercial'` in Model C (`packages/billing/src/config/model-c-field-split.ts`)
 * — the admin `PlanDialog.tsx` (SPEC-168) already lets operators edit a
 * plan's trial settings directly, so DB wins once a row exists. Editing the
 * baseline config (`TEST_DAILY_PLAN` in
 * `packages/billing/src/config/plans.config.ts`) alone only affects a FRESH
 * seed; an already-seeded staging/prod row (created either by a fresh
 * `--required` seed run or by `0004-test-daily-plan` on a live environment)
 * needs this explicit UPDATE to pick up the change.
 *
 * ## OR-PRESERVE semantics
 *
 * The UPDATE only fires for a row whose `metadata.hasTrial` /
 * `metadata.trialDays` are STILL the exact old baseline default
 * (`false` / `0`, including a legacy row that predates either key entirely,
 * via `COALESCE`). If an operator has already changed either field to some
 * other value through the admin plan editor, this migration leaves that
 * value alone — it never clobbers a deliberate operator edit, mirroring the
 * same "only touch rows still at the old default" guard `0003-hos16-deactivate-complex-plans`
 * uses for `active`, applied here to two JSONB metadata keys instead of a
 * plain boolean column.
 *
 * Re-running `up()` against an already-migrated database is always a no-op
 * (zero affected rows) once both keys read `true` / `1`, or once an operator
 * has moved either key off the old default — same shape as every other
 * migration in this carril.
 *
 * ## `destructive` flag decision
 *
 * Set to `false`. This migration only flips two JSONB metadata keys on a
 * single, well-identified test-only plan row from a known old default to a
 * known new default — it never deletes anything, and the change is trivially
 * reversible via a one-line manual `UPDATE billing_plans SET metadata =
 * metadata || '{"hasTrial":false,"trialDays":0}'::jsonb WHERE name =
 * 'owner-test-daily'` if ever needed.
 */
import { and, billingPlans, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0006-owner-test-daily-trial',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The single plan row this migration targets (`billing_plans.name` = the slug). */
const PLAN_NAME = 'owner-test-daily';

/** New trial config (matches `TEST_DAILY_PLAN.hasTrial` / `.trialDays` post-HOS-110). */
const NEW_HAS_TRIAL = true;
const NEW_TRIAL_DAYS = 1;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('hasTrial', ${NEW_HAS_TRIAL}::boolean, 'trialDays', ${NEW_TRIAL_DAYS}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingPlans.name, PLAN_NAME),
                // OR-PRESERVE: only touch a row still at the old baseline default
                // (COALESCE covers a legacy row missing either key entirely).
                sql`COALESCE((${billingPlans.metadata}->>'hasTrial')::boolean, false) = false`,
                sql`COALESCE((${billingPlans.metadata}->>'trialDays')::int, 0) = 0`
            )
        )
        .returning({ id: billingPlans.id });

    const rowsUpdated = updated.length;

    return {
        summary: `Set metadata.hasTrial=true, metadata.trialDays=1 on ${rowsUpdated} "${PLAN_NAME}" plan row(s).`,
        counts: { rowsUpdated }
    };
}
