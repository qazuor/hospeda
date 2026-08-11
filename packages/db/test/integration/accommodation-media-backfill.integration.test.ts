/**
 * Integration test for the accommodation media extras after the HOS-372 cutover.
 *
 * These three extras files all read `accommodations.media`:
 *
 *   005-media.constraints.sql                          (two accommodation blocks)
 *   019-accommodation-media-backfill.data-migration.sql
 *   021-accommodation-media-strip-blob-photos.data-migration.sql
 *
 * HOS-372 dropped that column, which turns each of them into a statement against
 * a column that no longer exists. `db:apply-extras` runs the carril as ONE batch,
 * so a single failure skips every later file — the whole carril goes down, not
 * just the obsolete block. Each file therefore guards on the COLUMN (not the
 * table, which outlives it) and returns early.
 *
 * That early return is the property under test now. The suite this replaced
 * asserted the backfill's row-mapping behaviour (SPEC-204 T-010), which cannot
 * be exercised any more: with the column gone there is nowhere to seed the JSONB
 * a backfill would read, so every one of those assertions could only ever see an
 * empty table. Testing the no-op is not a weaker test — it is the invariant that
 * actually protects the deploy.
 *
 * Uses `withCleanSlate` (TRUNCATE-based) rather than `withTestTransaction`: the
 * extras are `DO $$` blocks whose writes a rollback-only transaction cannot
 * observe.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { accommodationMedia } from '../../src/schemas/accommodation/accommodation_media.dbschema.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTRAS_DIR = join(__dirname, '../../src/migrations/extras');

/** The three extras files that read `accommodations.media`. */
const GUARDED_EXTRAS = [
    '005-media.constraints.sql',
    '019-accommodation-media-backfill.data-migration.sql',
    '021-accommodation-media-strip-blob-photos.data-migration.sql'
] as const;

/** Applies one extras file verbatim against the current test DB. */
async function applyExtra(fileName: string): Promise<void> {
    const db = getTestDb();
    const content = await readFile(join(EXTRAS_DIR, fileName), 'utf-8');
    await db.execute(sql.raw(content));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    // Wire @repo/db's module-level getDb() to the ephemeral test pool.
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('accommodation media extras after the media-column drop (HOS-372)', () => {
    /**
     * The precondition every assertion below depends on. Without it the suite
     * would still pass while silently testing the pre-cutover schema — the exact
     * way the previous version of this file went stale.
     */
    it('the accommodations.media column is gone', async () => {
        const db = getTestDb();
        const result = await db.execute(sql`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'accommodations'
              AND column_name = 'media'
        `);
        expect(result.rows).toHaveLength(0);
    });

    it.each(GUARDED_EXTRAS)('%s applies cleanly with no media column', async (fileName) => {
        // A throw here is the real failure mode: db:apply-extras runs the carril
        // as one batch, so this file erroring would skip every later file too.
        await expect(applyExtra(fileName)).resolves.toBeUndefined();
    });

    it('the backfill inserts nothing — it has no column left to read', async () => {
        await withCleanSlate(async (db) => {
            await applyExtra('019-accommodation-media-backfill.data-migration.sql');

            const rows = await db.select().from(accommodationMedia);
            expect(rows).toHaveLength(0);
        });
    });

    it('re-applying every guarded extra in order stays clean', async () => {
        // Mirrors what db:apply-extras does on each deploy: the carril is
        // re-applied wholesale, so these must be idempotent no-ops, not
        // one-shot statements that only survive their first run.
        for (const fileName of GUARDED_EXTRAS) {
            await applyExtra(fileName);
        }
        for (const fileName of GUARDED_EXTRAS) {
            await expect(applyExtra(fileName)).resolves.toBeUndefined();
        }
    });
});
