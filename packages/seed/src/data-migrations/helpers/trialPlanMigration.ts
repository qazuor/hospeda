/**
 * @file trialPlanMigration.ts
 * @description Shared body of the three HOS-1012 trial-plan data-migrations
 * (0073 / 0074 / 0075).
 *
 * The three migrations differ in exactly one value — which vertical they seed —
 * so the alternative to this helper is three near-identical files, and the
 * failure mode of three near-identical files is the one §6.8 already calls out
 * for `if`-chains: the third one is always the one that gets forgotten when the
 * shape changes.
 *
 * `write` is injected rather than imported here so the helper stays testable
 * without a database.
 */
import type { TrialPlanEntry } from '@repo/billing';
import type { ProductDomainValue } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationResult } from '../types.js';

/** The writer signature (`ensureTrialPlanRow`), injected for testability. */
export type TrialPlanWriter = (input: {
    readonly db: SeedMigrationCtx['db'];
    readonly entry: TrialPlanEntry;
    readonly livemode: boolean;
}) => Promise<'created' | 'restamped' | 'skipped'>;

/**
 * Seeds ONE vertical's trial plan into an already-seeded environment.
 *
 * Resolves the entry by `productDomain` and throws when the vertical declares
 * none. That throw is the point: a migration that silently wrote nothing would
 * still be recorded `ok` in the ledger and never retried (HOS-433), so "the
 * plan I was meant to insert does not exist" has to abort the run rather than
 * report zero rows.
 *
 * @param input.ctx - The migration context; only `ctx.db` is used.
 * @param input.productDomain - Which vertical's trial plan to write.
 * @param input.migrationName - Used in the error message and the summary.
 * @param input.entries - The declared trial plans (`ALL_TRIAL_PLANS`).
 * @param input.write - The row writer (`ensureTrialPlanRow`).
 * @returns The migration summary plus per-outcome counters.
 */
export async function runTrialPlanMigration(input: {
    readonly ctx: SeedMigrationCtx;
    readonly productDomain: ProductDomainValue;
    readonly migrationName: string;
    readonly entries: readonly TrialPlanEntry[];
    readonly write: TrialPlanWriter;
}): Promise<SeedMigrationResult> {
    const { ctx, productDomain, migrationName, entries, write } = input;

    const entry = entries.find((e) => e.productDomain === productDomain);
    if (!entry) {
        throw new Error(
            `${migrationName}: no trial plan is declared for product domain '${productDomain}' — refusing to record an empty run as applied`
        );
    }

    const outcome = await write({
        db: ctx.db,
        entry,
        livemode: process.env.NODE_ENV === 'production'
    });

    return {
        summary: `HOS-1012 D-5: trial plan "${entry.plan.slug}" (${productDomain}) ${outcome}`,
        counts: {
            plansCreated: outcome === 'created' ? 1 : 0,
            plansRestamped: outcome === 'restamped' ? 1 : 0
        }
    };
}
