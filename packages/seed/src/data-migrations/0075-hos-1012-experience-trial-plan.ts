/**
 * @fileoverview
 * Data migration: 0075-hos-1012-experience-trial-plan
 *
 * Puts the EXPERIENCE trial plan (`experience-trial`) into an already-seeded
 * environment. See `0073-hos-1012-owner-trial-plan.ts` for the full rationale —
 * why the dual-write rule requires this file at all, why there is one migration
 * per vertical, what is and is not re-stamped on a re-run, and why no
 * `billing_prices` row is created.
 *
 * A distinct plan from gastronomy's, not a shared one, for the same reason
 * `EXPERIENCE_BASICO_PLAN` is distinct from `GASTRONOMY_BASICO_PLAN`: trial
 * eligibility is keyed on `(customerId, productDomain)`, so an owner who spent
 * their gastronomy trial still receives one when they later add an experience.
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
    name: '0075-hos-1012-experience-trial-plan',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Applies the experience trial plan to an existing environment.
 *
 * @param ctx - Data-migration context; only `ctx.db` is used.
 * @returns A summary plus the row counters.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return runTrialPlanMigration({
        ctx,
        productDomain: ProductDomainEnum.EXPERIENCE,
        migrationName: meta.name,
        entries: ALL_TRIAL_PLANS,
        write: ensureTrialPlanRow
    });
}
