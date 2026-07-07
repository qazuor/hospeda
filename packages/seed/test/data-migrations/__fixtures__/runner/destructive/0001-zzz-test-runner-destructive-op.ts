/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009). Flagged
 * `destructive: true` so the production safety gate
 * (`evaluateProdDataMigrationGate`, T-011) refuses to run it under
 * `NODE_ENV=production` without an explicit opt-in. Its `up()` must never
 * execute in that scenario — the gate aborts the run before scheduling any
 * migration.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-runner-destructive-op',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
