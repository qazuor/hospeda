/**
 * @fileoverview
 * Data migration: 0074-hos-1012-gastronomy-trial-plan
 *
 * Puts the GASTRONOMY trial plan (`gastronomy-trial`) into an already-seeded
 * environment. See `0073-hos-1012-owner-trial-plan.ts` for the full rationale —
 * why the dual-write rule requires this file at all, why there is one migration
 * per vertical, what is and is not re-stamped on a re-run, and why no
 * `billing_prices` row is created.
 *
 * This closes OQ-2 on the gastronomy side: gastronomy DOES get a trial, and it
 * gets its OWN plan rather than the accommodation one — `createTrialSubscription`
 * throws when the plan's `product_domain` does not match the trial being
 * started, so a shared plan would not degrade quietly, it would fail every
 * gastronomy first-publish.
 *
 * ## `destructive` flag decision
 *
 * `false`. It inserts a row that did not exist and deletes nothing.
 */
import { ALL_TRIAL_PLANS } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { ensureTrialPlanRow } from '../required/trialPlans.writer.js';
import { runTrialPlanMigration } from './helpers/trialPlanMigration.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0074-hos-1012-gastronomy-trial-plan',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Applies the gastronomy trial plan to an existing environment.
 *
 * @param ctx - Data-migration context; only `ctx.db` is used.
 * @returns A summary plus the row counters.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return runTrialPlanMigration({
        ctx,
        productDomain: ProductDomainEnum.GASTRONOMY,
        migrationName: meta.name,
        entries: ALL_TRIAL_PLANS,
        write: ensureTrialPlanRow
    });
}
