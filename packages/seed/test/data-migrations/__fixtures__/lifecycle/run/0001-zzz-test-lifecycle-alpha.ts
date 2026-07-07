/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * First of two in the `run/` fixture set, used to exercise the
 * pending -> applied -> no-op-re-run lifecycle across `runMigrations`,
 * `getMigrationStatus`, and `getAppliedMigrations`.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-lifecycle-alpha',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
