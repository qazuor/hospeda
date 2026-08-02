/**
 * Fixture data-migration for `contentOnly.integration.test.ts` (HOS-375 G-10).
 *
 * The CONTENT-ONLY case: no fixture reproduces the row this migration writes,
 * so the migration file itself is the only source of it. `baselineStamp` must
 * leave it pending (reporting it under `deferred`) so a subsequent
 * `runMigrations` actually applies it — the test asserts its scratch row IS
 * present afterwards, and its ledger row reads `result = 'ok'`.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0002-zzz-test-contentonly-content',
    group: 'required',
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(
        sql`INSERT INTO zzz_test_contentonly_scratch (name) VALUES (${meta.name})`
    );
    return { summary: `inserted ${meta.name}` };
};
