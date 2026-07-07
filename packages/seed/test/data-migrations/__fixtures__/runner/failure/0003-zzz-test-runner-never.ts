/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009). Third of three
 * in the `failure/` fixture set: must NEVER run, because `0002-throws.ts`
 * aborts the whole batch (HOS-25 G-5). If the runner incorrectly continued
 * past a failure, this row would appear in the scratch table.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0003-zzz-test-runner-never',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
