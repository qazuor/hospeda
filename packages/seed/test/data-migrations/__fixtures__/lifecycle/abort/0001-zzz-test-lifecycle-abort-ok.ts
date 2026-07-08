/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * First of three in the `abort/` fixture set: succeeds, so the lifecycle
 * test can assert it commits and stays applied even though a later sibling
 * in the same batch throws.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-lifecycle-abort-ok',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
