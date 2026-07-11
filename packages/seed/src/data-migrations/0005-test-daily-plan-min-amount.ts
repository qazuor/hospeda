/**
 * @fileoverview
 * Data migration: 0005-test-daily-plan-min-amount
 *
 * Corrects the daily `billing_prices` row for the hidden internal test plan
 * `owner-test-daily` (`TEST_DAILY_PLAN` / `TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS`
 * in `packages/billing/src/config/plans.config.ts`, seeded by
 * `0004-test-daily-plan.ts`) so its `unit_amount` matches MercadoPago's real
 * minimum recurring `preapproval` amount.
 *
 * ## Why this migration exists
 *
 * `TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS` originally shipped as `100`
 * (ARS $1.00), assumed to be a safe floor. In production, MercadoPago
 * rejected every checkout attempted against this plan with:
 *
 * ```
 * Create subscription - Cannot pay an amount lower than $ 15.00
 * ```
 *
 * surfaced to the client as a generic `INTERNAL_ERROR` with no useful detail.
 * The constant was raised to `1500` (ARS $15.00 — MercadoPago's confirmed
 * minimum) in the same change that introduces this migration.
 *
 * `0004-test-daily-plan.ts` only INSERTS the daily price row when no
 * matching row exists yet (`(plan_id, currency='ARS', billing_interval='day',
 * interval_count=1)` — see its own JSDoc). It cannot self-heal an
 * already-seeded environment whose price row was written at the old `100`
 * value: the runner only ever applies a given migration once per environment
 * (per its ledger), so `0004` will never run again there to pick up the new
 * constant. This migration is the explicit, repeatable UPDATE that converges
 * any already-seeded environment (including the one that was hand-patched
 * directly in production, ahead of this migration, to unblock checkout
 * immediately) to the corrected amount, and is a guaranteed no-op on a
 * FRESH environment where `0004` already inserted the row at `1500`.
 *
 * ## Idempotency
 *
 * The `UPDATE` is scoped to rows whose `unit_amount` is not already the
 * target value (`ne(billingPrices.unitAmount, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS)`),
 * so re-running this migration (or running it against an environment where
 * `0004` already wrote the correct amount) always affects zero rows on the
 * second and subsequent calls.
 *
 * Must not fail if the `owner-test-daily` plan row does not exist yet on the
 * target environment (e.g. `HOSPEDA_SHOW_TEST_BILLING_PLAN` tooling was never
 * seeded there) — in that case this migration is a documented no-op; `0004`
 * will create the row at the correct `1500` amount whenever it does run.
 *
 * ## `destructive` flag decision
 *
 * Set to `false`. This migration only UPDATEs a single non-commercial-facing
 * internal test row's `unit_amount`, guarded to a no-op once converged. It
 * never deletes data, and re-running it against an already-migrated database
 * converges to the identical end state.
 */
import { TEST_DAILY_PLAN, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS } from '@repo/billing';
import { and, billingPlans, billingPrices, eq, ne } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0005-test-daily-plan-min-amount',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const plan = TEST_DAILY_PLAN;

    // ── Resolve the plan row (no-op if it does not exist yet) ────────────
    const existingPlan = await ctx.db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, plan.slug))
        .limit(1);

    const planRow = existingPlan[0];
    if (!planRow) {
        return {
            summary: `Plan "${plan.slug}" does not exist on this environment yet — nothing to update (0004-test-daily-plan will seed it at the correct amount whenever it runs).`,
            counts: { priceRowsUpdated: 0 }
        };
    }

    // ── Update the daily price row's unit_amount when it differs ─────────
    const updated = await ctx.db
        .update(billingPrices)
        .set({ unitAmount: TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS })
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'day'),
                eq(billingPrices.intervalCount, 1),
                ne(billingPrices.unitAmount, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS)
            )
        )
        .returning({ id: billingPrices.id });

    return {
        summary: `Set daily test-plan price to ${TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS} centavos (MercadoPago's ARS $15.00 preapproval minimum) on ${updated.length} row(s).`,
        counts: { priceRowsUpdated: updated.length }
    };
}
