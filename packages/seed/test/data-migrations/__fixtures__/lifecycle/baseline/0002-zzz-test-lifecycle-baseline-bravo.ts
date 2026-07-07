/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * Second of two in the `baseline/` fixture set — belongs to the `example`
 * group. See `0001-zzz-test-lifecycle-baseline-alpha.ts` for the fixture
 * set's rationale.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-lifecycle-baseline-bravo',
    group: 'example'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
