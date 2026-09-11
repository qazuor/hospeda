/**
 * Fixture data-migration for `runner.integration.test.ts` (HOS-433).
 *
 * Declares a dependency on a column that DOES exist, so the test can assert
 * the gate lets a satisfied migration through untouched — the guard must not
 * become a blanket refusal.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-runner-requires-present',
    group: 'required',
    requiresColumns: [{ table: 'zzz_test_runner_scratch', column: 'name' }]
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
