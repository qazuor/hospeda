/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009). See
 * `0001-alpha.ts` for the shared scratch-table convention.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0003-zzz-test-runner-charlie',
    group: 'example'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
