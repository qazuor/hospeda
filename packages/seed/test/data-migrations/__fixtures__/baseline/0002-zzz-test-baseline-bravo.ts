/**
 * Fixture data-migration for `baselineStamp.test.ts` (HOS-25 T-010).
 * See `0001-zzz-test-baseline-alpha.ts` for the fixture's rationale.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-baseline-bravo',
    group: 'example'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_baseline_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
