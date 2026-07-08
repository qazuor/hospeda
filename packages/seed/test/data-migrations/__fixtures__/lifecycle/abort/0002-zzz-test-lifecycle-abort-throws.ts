/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * Second of three in the `abort/` fixture set: inserts a scratch row and THEN
 * throws, so the lifecycle test can assert `runMigrations` rolls back both
 * the insert and this migration's own ledger row (no partial commit), and
 * that `getMigrationStatus` still reports it as pending afterward.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-lifecycle-abort-throws',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    throw new Error('simulated migration failure (0002-zzz-test-lifecycle-abort-throws)');
};
