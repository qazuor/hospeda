// TEST:V1:12 (AC:V1:8, BD-014) — a new table gets its `set_updated_at` trigger
// after `db:apply-extras` (HOS-1433).
//
// `test/integration/global-setup.ts` builds an EMPTY database with the full
// versioned chain (`drizzle-kit migrate`, carril 1) and then runs the real
// `scripts/apply-postgres-extras.mjs` (carril 2). Over that database:
//
//   (a) generic — every public base table with an `updated_at` column carries a
//       trigger that executes `set_updated_at()`;
//   (b) concrete — `email_outbox`, the first new table of the branch with an
//       `updated_at` (migration 0130), has the trigger, and updating a row moves
//       `updated_at` without the statement naming the column;
//   (c) the "new table" path — a throwaway table created AFTER the extras ran has
//       NO trigger until the extras are re-applied by the same script, and has it
//       (and the behaviour) afterwards.
//
// No migration and no new extras file: `extras/002-set-updated-at.trigger.sql`
// already loops over every public table with `updated_at` (owner decision).
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXTRAS_SCRIPT = resolve(PKG_DIR, 'scripts/apply-postgres-extras.mjs');

/** The first new table of the branch that has an `updated_at` column (0130). */
const FIRST_NEW_TABLE = 'email_outbox';

/** Throwaway table for the "new table" path; dropped after the test. */
const PROBE_TABLE = 'hos1433_set_updated_at_probe';

/** A timestamp far in the past, so a moved `updated_at` is unambiguous. */
const OLD_TIMESTAMP = '2000-01-01T00:00:00Z';

/** Public base tables that have an `updated_at` column. */
async function tablesWithUpdatedAt(): Promise<string[]> {
    const result = await getTestPool().query<{ table_name: string }>(
        `SELECT c.table_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
         WHERE c.table_schema = 'public'
           AND c.column_name = 'updated_at'
           AND t.table_type = 'BASE TABLE'
         ORDER BY c.table_name`
    );
    return result.rows.map((r) => r.table_name);
}

/** Public tables that carry a trigger executing `set_updated_at()`. */
async function tablesWithSetUpdatedAtTrigger(): Promise<Set<string>> {
    const result = await getTestPool().query<{ table_name: string }>(
        `SELECT c.relname AS table_name
         FROM pg_trigger tg
         JOIN pg_class c ON c.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_proc p ON p.oid = tg.tgfoid
         WHERE n.nspname = 'public'
           AND p.proname = 'set_updated_at'
           AND NOT tg.tgisinternal`
    );
    return new Set(result.rows.map((r) => r.table_name));
}

/** Re-applies every extras file with the same script `db:apply-extras` uses. */
function applyExtras(): void {
    const url = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!url) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
    execFileSync('node', [EXTRAS_SCRIPT, url], { cwd: PKG_DIR, stdio: 'pipe', timeout: 60_000 });
}

/**
 * Inserts a row with an old `updated_at`, then updates another column in a
 * separate statement (so `NOW()` is a later transaction) and returns the
 * resulting `updated_at`.
 */
async function updatedAtAfterUpdate(input: {
    readonly insertSql: string;
    readonly updateSql: string;
}): Promise<Date> {
    const pool = getTestPool();
    const inserted = await pool.query<{ id: string }>(input.insertSql, [OLD_TIMESTAMP]);
    const id = inserted.rows[0]?.id;
    const updated = await pool.query<{ updated_at: Date }>(input.updateSql, [id]);
    const value = updated.rows[0]?.updated_at;
    if (!value) throw new Error('update returned no row');
    return value;
}

afterAll(async () => {
    await getTestPool().query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);
    await getTestPool().query(`DELETE FROM ${FIRST_NEW_TABLE} WHERE dedup_key LIKE 'hos1433:%'`);
    await closeTestPool();
});

describe('TEST:V1:12 — set_updated_at trigger after migrate + apply-extras (HOS-1433)', () => {
    it('(a) every public table with updated_at has the set_updated_at trigger', async () => {
        const tables = await tablesWithUpdatedAt();
        const withTrigger = await tablesWithSetUpdatedAtTrigger();

        const missing = tables.filter((table) => !withTrigger.has(table));

        expect(tables.length).toBeGreaterThan(0);
        expect(missing).toEqual([]);
    });

    it(`(b) ${FIRST_NEW_TABLE} has the trigger and an update moves updated_at`, async () => {
        const withTrigger = await tablesWithSetUpdatedAtTrigger();
        expect(withTrigger.has(FIRST_NEW_TABLE)).toBe(true);

        const updatedAt = await updatedAtAfterUpdate({
            insertSql: `INSERT INTO ${FIRST_NEW_TABLE}
                (recipient_email, template, dedup_key, created_at, updated_at)
                VALUES ('hos1433@local.test', 'probe', 'hos1433:' || gen_random_uuid(), $1, $1)
                RETURNING id`,
            updateSql: `UPDATE ${FIRST_NEW_TABLE} SET attempts = attempts + 1
                WHERE id = $1 RETURNING updated_at`
        });

        expect(updatedAt.getTime()).toBeGreaterThan(new Date(OLD_TIMESTAMP).getTime());
    });

    it('(c) a table created after the extras gets the trigger once they are re-applied', async () => {
        await getTestPool().query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);
        await getTestPool().query(
            `CREATE TABLE ${PROBE_TABLE} (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                note text NOT NULL DEFAULT '',
                updated_at timestamp with time zone NOT NULL DEFAULT now()
            )`
        );
        expect((await tablesWithSetUpdatedAtTrigger()).has(PROBE_TABLE)).toBe(false);

        applyExtras();

        expect((await tablesWithSetUpdatedAtTrigger()).has(PROBE_TABLE)).toBe(true);
        const updatedAt = await updatedAtAfterUpdate({
            insertSql: `INSERT INTO ${PROBE_TABLE} (updated_at) VALUES ($1) RETURNING id`,
            updateSql: `UPDATE ${PROBE_TABLE} SET note = 'touched' WHERE id = $1 RETURNING updated_at`
        });
        expect(updatedAt.getTime()).toBeGreaterThan(new Date(OLD_TIMESTAMP).getTime());
    });
});
