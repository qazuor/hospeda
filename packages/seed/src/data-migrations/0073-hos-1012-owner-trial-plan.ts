/**
 * @fileoverview
 * Data migration: 0073-hos-1012-owner-trial-plan
 *
 * Puts the ACCOMMODATION trial plan (`owner-trial`) into an already-seeded
 * environment. `required/trialPlans.seed.ts` is the baseline half of the same
 * write.
 *
 * ## Why this exists (the dual-write rule, and trap T-2 of HOS-1012)
 *
 * `packages/billing/src/config/trial-plans.config.ts` is a guarded baseline in
 * `scripts/check-seed-dual-write.sh`, and for the reason that trap names: since
 * HOS-39 the plan config is the commercial layer and THE DATABASE WINS. Editing
 * the config alone passes every local test, builds a fresh database correctly,
 * and changes nothing whatsoever in staging or production — a trial plan no
 * publish can resolve, with the build green throughout.
 *
 * ## One migration per vertical
 *
 * Three files rather than one, so a vertical can be shipped, held or rolled
 * back on its own ledger entry. They share ONE writer
 * (`required/trialPlans.writer.ts`) so a fresh database and an already-seeded
 * one cannot end up with differently-shaped rows — which matters more here than
 * usual, because the row's `metadata.trialComposition` is what actually gates a
 * request.
 *
 * ## Idempotency
 *
 * INSERT-if-absent on `name` (the slug), then a re-stamp of `product_domain` +
 * `metadata.trialComposition` that is a no-op when already correct. The
 * entitlements/limits SNAPSHOT on an existing row is never overwritten: both
 * are `'commercial'` fields, so an operator edit stands, and a stale snapshot
 * is a screen showing an old number rather than a door opening for the wrong
 * person.
 *
 * No `billing_prices` row is created. A trial plan is granted at first publish
 * and never bought.
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
    name: '0073-hos-1012-owner-trial-plan',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Applies the accommodation trial plan to an existing environment.
 *
 * @param ctx - Data-migration context; only `ctx.db` is used.
 * @returns A summary plus the row counters.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    return runTrialPlanMigration({
        ctx,
        productDomain: ProductDomainEnum.ACCOMMODATION,
        migrationName: meta.name,
        entries: ALL_TRIAL_PLANS,
        write: ensureTrialPlanRow
    });
}
