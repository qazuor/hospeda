/**
 * Fixture data-migration for `contentOnly.integration.test.ts` (HOS-375 G-10).
 *
 * The ORDINARY case: a migration whose end state a fresh baseline seed already
 * produces, so `baselineStamp` must record it applied without ever calling
 * `up()`. Its `up()` would insert a traceable row into the shared scratch
 * table if it ever ran — the test asserts that row never appears.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../src/data-migrations/types.js';

export const meta = {
    name: '0001-zzz-test-contentonly-baseline',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(
        sql`INSERT INTO zzz_test_contentonly_scratch (name) VALUES (${meta.name})`
    );
    return { summary: `inserted ${meta.name}` };
};
