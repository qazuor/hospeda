/**
 * @fileoverview
 * Integration tests for `meta.contentOnly` (HOS-375 T-037, G-10).
 *
 * These reproduce a FRESH BUILD end to end — the exact sequence
 * `pnpm db:fresh-dev` performs, minus the baseline seed itself:
 * `baselineStamp()` followed by `runMigrations()`, the fall-through
 * `handleDataMigrate` now implements for `--baseline-stamp`.
 *
 * The invariant under test is the one the flag exists for: a migration whose
 * rows have NO fixture baseline must NOT be stamped, because stamping records
 * it applied while its content never existed and the ledger then stops it
 * from ever running. Concretely, after one fresh-build sequence:
 *
 * - the ordinary migration ends with ledger `result = 'baseline-stamp'` and
 *   its `up()` never ran;
 * - the content-only one ends with ledger `result = 'ok'` and its `up()` DID
 *   run;
 * - a second pass re-runs neither, in either mode.
 *
 * Runs against the ephemeral integration database, following the bootstrap
 * convention of the sibling files (`baselineStamp.integration.test.ts`,
 * `lifecycle.integration.test.ts`): a minimal `pg` `Pool` + `@repo/db`'s
 * `initializeDb()`, with `HOSPEDA_DATABASE_URL` loaded from
 * `apps/api/.env.local` and overridden by the integration `globalSetup`.
 * `seedMigrations` is imported from the narrower `@repo/db/schemas` subpath
 * (not the top-level `@repo/db` barrel) — see `ledger.test.ts`'s file-level
 * comment for why.
 *
 * Fixtures live under `__fixtures__/content-only/` and write only to a
 * disposable scratch table (`zzz_test_contentonly_scratch`); every fixture
 * name carries the `zzz-test-contentonly-` prefix so ledger rows can be
 * namespace-deleted by `LIKE` in `afterEach`, matching this package's
 * established `zzz-test-*`/`zzz_test_*` convention.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { seedMigrations } from '@repo/db/schemas';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { baselineStamp } from '../../src/data-migrations/baselineStamp.js';
import { getAppliedMigrations } from '../../src/data-migrations/ledger.js';
import { runMigrations } from '../../src/data-migrations/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const FIXTURES_DIR = path.resolve(__dirname, '__fixtures__/content-only');

const SCRATCH_TABLE = 'zzz_test_contentonly_scratch';
const NAME_PREFIX = 'zzz-test-contentonly-';

const BASELINE_MIGRATION = '0001-zzz-test-contentonly-baseline';
const CONTENT_MIGRATION = '0002-zzz-test-contentonly-content';

const STUB_ACTOR: Actor = {
    id: 'zzz-test-contentonly-actor',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

let pool: Pool;

/** Reads the scratch table's `name` column, ordered by insertion (`id`). */
async function readScratchNames(): Promise<string[]> {
    const db = getDb();
    const result = await db.execute<{ name: string }>(
        sql`SELECT name FROM ${sql.identifier(SCRATCH_TABLE)} ORDER BY id ASC`
    );
    return result.rows.map((row) => row.name);
}

/** Reads every ledger row belonging to this test file's namespace, keyed by migration name. */
async function readLedgerByName() {
    const { rows } = await getAppliedMigrations({ db: getDb() });
    return new Map(
        rows.filter((row) => row.name.includes(NAME_PREFIX)).map((row) => [row.name, row])
    );
}

/**
 * Performs one full fresh-build data-migration sequence: baseline-stamp
 * first, then a real run — exactly what `handleDataMigrate` does when
 * `--baseline-stamp` is passed (HOS-375 §6.11).
 */
async function freshBuildSequence() {
    const stamp = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });
    const run = await runMigrations({ db: getDb(), dir: FIXTURES_DIR, actor: STUB_ACTOR });
    return { stamp, run };
}

describe('HOS-375 T-037: meta.contentOnly on a fresh build (integration)', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);

        const db = getDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(SCRATCH_TABLE)} CASCADE`);
        await db.execute(sql`
            CREATE TABLE ${sql.identifier(SCRATCH_TABLE)} (
                id serial PRIMARY KEY,
                name text NOT NULL
            )
        `);
    });

    afterEach(async () => {
        const db = getDb();
        await db.execute(sql`DELETE FROM ${sql.identifier(SCRATCH_TABLE)}`);
        await db.execute(
            sql`DELETE FROM ${seedMigrations} WHERE ${seedMigrations.name} LIKE ${`%${NAME_PREFIX}%`}`
        );
    });

    afterAll(async () => {
        const db = getDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(SCRATCH_TABLE)} CASCADE`);
        await pool.end();
        resetDb();
    });

    it('leaves a contentOnly migration pending instead of stamping it, reporting it as deferred', async () => {
        const stamp = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });

        expect(stamp.stamped).toEqual([BASELINE_MIGRATION]);
        expect(stamp.deferred).toEqual([CONTENT_MIGRATION]);

        // Deferred means PENDING, not silently applied: no ledger row exists
        // for it yet, and its up() has not run.
        const { names: applied } = await getAppliedMigrations({ db: getDb() });
        expect(applied.has(BASELINE_MIGRATION)).toBe(true);
        expect(applied.has(CONTENT_MIGRATION)).toBe(false);
        expect(await readScratchNames()).toEqual([]);
    });

    it("applies exactly the contentOnly migration on the fall-through run — 'ok' vs 'baseline-stamp'", async () => {
        const { stamp, run } = await freshBuildSequence();

        expect(stamp.stamped).toEqual([BASELINE_MIGRATION]);
        expect(stamp.deferred).toEqual([CONTENT_MIGRATION]);

        // The run finds the ordinary migration already ledgered and applies
        // only the deferred one.
        expect(run.applied).toEqual([CONTENT_MIGRATION]);
        expect(run.skipped).toEqual([BASELINE_MIGRATION]);
        expect(run.pendingCount).toBe(1);

        // The scratch table is the proof of which up() actually executed:
        // the content-only migration's row exists, the ordinary one's does not.
        expect(await readScratchNames()).toEqual([CONTENT_MIGRATION]);

        // AC-18's ledger shape: 'ok' for content-only, 'baseline-stamp' for
        // everything else.
        const ledger = await readLedgerByName();
        expect(ledger.size).toBe(2);

        const baselineRow = ledger.get(BASELINE_MIGRATION);
        expect(baselineRow?.result).toBe('baseline-stamp');
        expect(baselineRow?.durationMs).toBe(0);

        const contentRow = ledger.get(CONTENT_MIGRATION);
        expect(contentRow?.result).toBe('ok');
        expect(contentRow?.checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not re-run or re-stamp anything on a second fresh-build sequence', async () => {
        await freshBuildSequence();

        const { stamp, run } = await freshBuildSequence();

        // Both migrations are ledgered now, so nothing is pending — which
        // means nothing is deferred either.
        expect(stamp.stamped).toEqual([]);
        expect(stamp.deferred).toEqual([]);
        expect(run.applied).toEqual([]);
        expect(run.pendingCount).toBe(0);
        expect(run.skipped.slice().sort()).toEqual([BASELINE_MIGRATION, CONTENT_MIGRATION].sort());

        // The content-only up() ran exactly once across both sequences: the
        // ledger is respected, so this fix is not retroactive and not
        // repeatable (HOS-375 §6.11, scope boundary).
        expect(await readScratchNames()).toEqual([CONTENT_MIGRATION]);

        const ledger = await readLedgerByName();
        expect(ledger.size).toBe(2);
    });

    it('refuses to run without an actor rather than bootstrapping a seeded super admin', async () => {
        // The fall-through means a `--baseline-stamp` invocation now really
        // runs migrations, including on the production day-1 path that seeds
        // with `--required --exclude=users` precisely to keep the well-known
        // superadmin@hospeda.com credential off the box. The runner must fail
        // loudly there instead of manufacturing that account.
        //
        // The integration database has no users at all (globalSetup seeds only
        // billing plans), so omitting `actor` exercises exactly that path.
        await baselineStamp({ db: getDb(), dir: FIXTURES_DIR });

        await expect(runMigrations({ db: getDb(), dir: FIXTURES_DIR })).rejects.toThrow(
            /no SUPER_ADMIN account/
        );

        // Nothing was applied and, critically, no user was created as a
        // side effect of trying.
        expect(await readScratchNames()).toEqual([]);

        const userCount = await getDb().execute<{ count: string }>(
            sql`SELECT COUNT(*)::text AS count FROM users`
        );
        expect(userCount.rows[0]?.count).toBe('0');
    });

    it('stamps normally when the group filter excludes the contentOnly migration', async () => {
        // Both fixtures are group 'required'; scoping to 'example' must
        // produce an empty batch rather than misreporting the content-only
        // one as deferred — deferral is about what WOULD have been stamped.
        const stamp = await baselineStamp({ db: getDb(), dir: FIXTURES_DIR, group: 'example' });

        expect(stamp.stamped).toEqual([]);
        expect(stamp.deferred).toEqual([]);

        const { names: applied } = await getAppliedMigrations({ db: getDb() });
        expect(applied.has(BASELINE_MIGRATION)).toBe(false);
        expect(applied.has(CONTENT_MIGRATION)).toBe(false);
    });
});
