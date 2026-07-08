/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * Second of two in the `run/` fixture set — belongs to the `example` group
 * (vs. its sibling's `required`) so the lifecycle test can also assert group
 * scoping stays consistent across the status/ledger seam.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-lifecycle-bravo',
    group: 'example'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
