/**
 * Fixture data-migration for `lifecycle.integration.test.ts` (HOS-25 T-021).
 * Third of three in the `abort/` fixture set: would insert a scratch row IF
 * it ever ran — but the batch must abort at its `0002-...-throws` sibling
 * (HOS-25 G-5, no partial runs), so this `up()` must never be invoked.
 */
import { sql } from 'drizzle-orm';
import type { SeedMigrationModule } from '../../../../../src/data-migrations/types.js';

export const meta = {
    name: '0003-zzz-test-lifecycle-abort-never',
    group: 'required'
} as const satisfies SeedMigrationModule['meta'];

export const up: SeedMigrationModule['up'] = async (ctx) => {
    await ctx.db.execute(sql`INSERT INTO zzz_test_lifecycle_scratch (name) VALUES (${meta.name})`);
    return { summary: `inserted ${meta.name}` };
};
