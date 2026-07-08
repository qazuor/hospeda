/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * First of two in the `baseline/` fixture set. Its `up()` would insert a
 * traceable row into the shared scratch table IF it ever ran — but
 * `baselineStamp` must never call it. The lifecycle test asserts the scratch
 * table stays empty after stamping, proving `up()` was skipped entirely.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-lifecycle-baseline-alpha',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
