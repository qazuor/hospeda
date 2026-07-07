/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009).
 * Inserts a single traceable row into the shared scratch table so the test
 * can assert execution order and ledger round-tripping.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-runner-alpha',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
