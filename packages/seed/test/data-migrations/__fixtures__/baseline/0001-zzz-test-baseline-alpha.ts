/**
 * Fixture data-migration for `baselineStamp.test.ts` (HOS-25 T-010).
 *
 * Its `up()` would insert a traceable row into the shared scratch table IF
 * it ever ran — but {@link baselineStamp} must never call it. The test
 * asserts the scratch table stays empty after stamping, proving `up()` was
 * skipped entirely.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-baseline-alpha',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_baseline_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
