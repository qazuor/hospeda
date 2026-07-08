/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009). First of three
 * in the `failure/` fixture set: succeeds normally, so its ledger row and
 * scratch-table insert must both survive a LATER migration's failure.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-runner-ok',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
