/**
 * Fixture data-migration for `runner.test.ts` (HOS-25 T-009). Second of
 * three in the `failure/` fixture set: inserts a scratch row and THEN
 * throws, so the test can assert the runner rolls back both the insert and
 * the ledger row for this migration (no partial commit).
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-runner-throws',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_runner_scratch (name) VALUES (${meta.name})`);
    throw new Error('simulated migration failure (0002-zzz-test-runner-throws)');
};
