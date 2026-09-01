/**
 * Fixture data-migration for `runner.integration.test.ts` (HOS-433).
 *
 * Declares a dependency on a column that does not exist, reproducing the
 * shape of `0034-hos-372-commerce-media-to-relational` running AFTER the
 * structural migration that dropped its source column.
 *
 * `up()` inserts a scratch row unconditionally, so the test can assert the
 * runner refused BEFORE reaching it rather than running it and rolling back.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-runner-requires-missing',
    group: 'required',
    requiresColumns: [{ table: 'zzz_test_runner_scratch', column: 'zzz_column_that_never_existed' }]
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
