/**
 * @fileoverview
 * Data migration: 0132-hos1943-price-on-request-null
 *
 * Owner decision (HOS-1943, 01/11, option a): an experience "a consultar"
 * (`is_price_on_request = true`) stores `price_from = NULL`, not 0. A 0 read as
 * "$0" anywhere the flag was not checked first, and sorted as the cheapest
 * listing.
 *
 * ## Run order
 *
 * Structural migration `0183_hos1943_price_from_nullable` drops the column's
 * `NOT NULL` and its `DEFAULT 0`; `db:migrate` runs it before this one. If it
 * has not run, the UPDATE below fails on the NOT NULL constraint, the runner
 * rolls the transaction back and nothing is ledgered, so the failure is loud.
 *
 * The CHECK `is_price_on_request => price_from IS NULL` is NOT shipped with this
 * release: `db:apply-extras` runs before `db:seed:migrate`, so it would reject
 * the rows this backfill has not reached yet. It belongs to the next release.
 *
 * ## Scope
 *
 * Only rows whose price is exactly 0. A row marked "a consultar" that carries a
 * positive price (an admin typed one before ticking the flag) is left alone:
 * that value is the only copy of a real number, and nulling it is an owner call,
 * not a backfill. The display layer already ignores it while the flag is on.
 *
 * Soft-deleted rows are included: the decision is about what the column means,
 * and a restored listing must not come back with a fake 0.
 *
 * ## Fresh databases
 *
 * The baseline fixture (`example/experiences.seed.ts`) seeds the on-request
 * experience with `priceFrom: null`, so `--baseline-stamp` is correct and
 * `up()` never needs to run on a fresh build.
 *
 * ## Idempotency
 *
 * The WHERE clause selects only `price_from = 0`, which the UPDATE turns into
 * NULL. A second run matches nothing.
 *
 * ## `destructive` flag decision
 *
 * `false` — the only value replaced is 0, which this decision defines as the
 * old spelling of "no price". Nothing is deleted and nothing real is lost.
 */
import { and, eq, experiences } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0132-hos1943-price-on-request-null',
    group: 'required',
    destructive: false,
    // HOS-433: the UPDATE reads both columns. If either is gone the runner
    // refuses instead of reporting zero rows and closing itself in the ledger.
    requiresColumns: [
        { table: 'experiences', column: 'price_from' },
        { table: 'experiences', column: 'is_price_on_request' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Turns the stored price of every "a consultar" experience from 0 into NULL.
 *
 * @param ctx - Migration context; only `ctx.db` (transaction-scoped) is used.
 * @returns A summary with the number of rows rewritten.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rewritten = await ctx.db
        .update(experiences)
        .set({ priceFrom: null })
        .where(and(eq(experiences.isPriceOnRequest, true), eq(experiences.priceFrom, 0)))
        .returning({ id: experiences.id });

    const experiencesRewritten = rewritten.length;
    return {
        summary:
            experiencesRewritten === 0
                ? 'No price-on-request experience stores price_from = 0; nothing to rewrite.'
                : `Set price_from = NULL on ${experiencesRewritten} price-on-request experience(s).`,
        counts: { experiencesRewritten }
    };
}
