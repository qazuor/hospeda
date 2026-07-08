/**
 * @fileoverview
 * Cross-cutting lifecycle integration test for the versioned seed
 * data-migration carril (HOS-25, T-021).
 *
 * Every individual piece already has its own green unit/integration
 * coverage: `runner.test.ts` (T-009, ordering/rollback/no-op/abort/prod
 * gate), `baselineStamp.test.ts` (T-010, stamp leaves zero pending, `up()`
 * never runs), `status.test.ts` (T-012, pure applied/pending
 * partition/orphans), and `billing-plans-port.test.ts` (T-020, the real
 * 0001-0003 billing migrations). This file does NOT re-prove any of that.
 *
 * Instead it asserts the INTEGRATION SEAMS between those pieces stay
 * mutually consistent across a full lifecycle:
 *
 * - {@link getMigrationStatus} and {@link runMigrations} must agree on what
 *   is pending BEFORE a run and what is applied AFTER it, since both derive
 *   from the exact same {@link resolvePendingMigrations} + ledger read.
 * - The raw ledger rows returned by {@link getAppliedMigrations} must match,
 *   name-for-name and group-for-group, what {@link getMigrationStatus}
 *   reports as `applied` and what {@link runMigrations} reports as
 *   `applied`/`skipped`.
 * - A mid-batch failure must leave the ledger — and therefore
 *   {@link getMigrationStatus}'s pending list — exactly as if the failing
 *   migration (and everything after it) had never been attempted.
 * - {@link baselineStamp} must produce ledger rows that
 *   {@link getMigrationStatus} reports as applied with `result:
 *   'baseline-stamp'`, without ever invoking the migration's `up()`.
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * bootstrap convention already established by `runner.test.ts` /
 * `baselineStamp.test.ts`: a minimal `pg` `Pool` + `@repo/db`'s
 * `initializeDb()`, loading `HOSPEDA_DATABASE_URL` from
 * `apps/api/.env.local`. `seedMigrations` is imported from the narrower
 * `@repo/db/schemas` subpath (not the top-level `@repo/db` barrel) — see
 * `runner.test.ts`'s file-level comment for why (a documented
 * Vitest/Vite SSR module-runner quirk with deeply-indirected `export *`
 * chains).
 *
 * ## Isolation from the shared worktree database
 *
 * `runMigrations` opens its OWN per-migration transaction internally (see
 * `runner.ts`'s module doc), so the whole run cannot be wrapped in one outer
 * rollback transaction the way `billing-plans-port.test.ts` wraps its
 * direct `up()` calls. Instead, every fixture migration here writes only to
 * a disposable scratch table (`zzz_test_lifecycle_scratch`, created in
 * `beforeAll` and dropped in `afterAll`) and every fixture migration name is
 * prefixed `zzz-test-lifecycle-`, so ledger rows can be namespace-deleted by
 * `LIKE` in `afterEach` — matching this package's established
 * `zzz-test-*`/`zzz_test_*` convention for disposable test fixtures in the
 * shared worktree database (see `runner.test.ts`, `baselineStamp.test.ts`).
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
import { discoverMigrationFiles } from '../../src/data-migrations/discover.js';
import { getAppliedMigrations } from '../../src/data-migrations/ledger.js';
import { runMigrations } from '../../src/data-migrations/runner.js';
import type {
    AppliedMigrationStatusEntry,
    MigrationStatus
} from '../../src/data-migrations/status.js';
import { getMigrationStatus } from '../../src/data-migrations/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as ledger.test.ts / runner.test.ts /
// baselineStamp.test.ts: HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const FIXTURES_DIR = path.resolve(__dirname, '__fixtures__/lifecycle');
const RUN_DIR = path.join(FIXTURES_DIR, 'run');
const ABORT_DIR = path.join(FIXTURES_DIR, 'abort');
const BASELINE_DIR = path.join(FIXTURES_DIR, 'baseline');

const SCRATCH_TABLE = 'zzz_test_lifecycle_scratch';
const NAME_PREFIX = 'zzz-test-lifecycle-';

const STUB_ACTOR: Actor = {
    id: 'zzz-test-lifecycle-actor',
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

/** Reads every ledger row belonging to this test file's namespace, ordered by name ascending. */
async function readLifecycleLedgerRows() {
    const { rows } = await getAppliedMigrations({ db: getDb() });
    return rows.filter((row) => row.name.includes(NAME_PREFIX));
}

/**
 * Filters a {@link MigrationStatus}'s `applied` entries down to rows
 * belonging to this test file's own namespace (`NAME_PREFIX`).
 *
 * `getMigrationStatus`'s `applied`/`appliedCount` intentionally reflect
 * EVERY row currently in the shared `seed_migrations` ledger table
 * (including orphaned rows with no matching file in the requested `dir` —
 * see `status.ts`'s module doc), not just the rows relevant to this test's
 * own fixtures. Against the real worktree database, the other
 * `test/data-migrations/**` integration files (`runner.test.ts`,
 * `baselineStamp.test.ts`, `billing-plans-port.test.ts`, `ledger.test.ts`)
 * write and clean up their OWN namespaced rows in that SAME table
 * concurrently — vitest runs test files in parallel worker forks (see
 * `vitest.config.ts`'s `pool: 'forks'` / `maxWorkers: 3`). A transient row
 * from one of those files can land inside this file's read window between
 * two `getMigrationStatus` calls, inflating `appliedCount` by one and
 * producing an `expected 2 to be 1`-style flake. Scoping every
 * count/assertion below to this file's own `zzz-test-lifecycle-` namespace
 * makes the test's correctness independent of whatever else is concurrently
 * happening to the shared ledger table.
 */
function scopedApplied(status: MigrationStatus): AppliedMigrationStatusEntry[] {
    return status.applied.filter((entry) => entry.name.includes(NAME_PREFIX));
}

describe('HOS-25 T-021: versioned seed data-migration lifecycle (integration seams, real worktree DB)', () => {
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

    it('agrees across status -> run -> status -> re-run -> ledger for a full pending-to-applied cycle', async () => {
        // Step 1: before anything runs, the status reporter and the runner's
        // own discovery+diff step must agree the whole fixture set is
        // pending.
        const before = await getMigrationStatus({ db: getDb(), dir: RUN_DIR });
        expect(scopedApplied(before)).toHaveLength(0);
        expect(before.pendingCount).toBe(2);
        expect(before.pending.map((entry) => entry.name)).toEqual([
            '0001-zzz-test-lifecycle-alpha',
            '0002-zzz-test-lifecycle-bravo'
        ]);
        expect(before.pending.map((entry) => entry.group)).toEqual(['required', 'example']);

        // Step 2: run the batch, then re-check status through the SAME
        // ledger — the runner and the status reporter must land on an
        // identical view of the world.
        const runResult = await runMigrations({ db: getDb(), dir: RUN_DIR, actor: STUB_ACTOR });
        expect(runResult.applied).toEqual([
            '0001-zzz-test-lifecycle-alpha',
            '0002-zzz-test-lifecycle-bravo'
        ]);
        expect(runResult.pendingCount).toBe(2);
        expect(runResult.skipped).toEqual([]);

        const afterRun = await getMigrationStatus({ db: getDb(), dir: RUN_DIR });
        const afterRunApplied = scopedApplied(afterRun);
        expect(afterRunApplied).toHaveLength(2);
        expect(afterRun.pendingCount).toBe(0);
        expect(afterRunApplied.map((entry) => entry.name)).toEqual(runResult.applied);
        expect(afterRunApplied.map((entry) => entry.group)).toEqual(['required', 'example']);
        for (const entry of afterRunApplied) {
            expect(entry.result).toBe('ok');
            expect(entry.orphaned).toBe(false);
        }

        // Step 3: re-running is a no-op, and status stays unchanged —
        // runMigrations and getMigrationStatus must independently compute
        // the exact same "nothing left to do" conclusion.
        const rerun = await runMigrations({ db: getDb(), dir: RUN_DIR, actor: STUB_ACTOR });
        expect(rerun.applied).toEqual([]);
        expect(rerun.pendingCount).toBe(0);
        expect(rerun.skipped.slice().sort()).toEqual(
            ['0001-zzz-test-lifecycle-alpha', '0002-zzz-test-lifecycle-bravo'].sort()
        );

        const afterRerun = await getMigrationStatus({ db: getDb(), dir: RUN_DIR });
        const afterRerunApplied = scopedApplied(afterRerun);
        expect(afterRerunApplied).toHaveLength(afterRunApplied.length);
        expect(afterRerun.pendingCount).toBe(0);
        expect(afterRerunApplied.map((entry) => entry.name)).toEqual(
            afterRunApplied.map((entry) => entry.name)
        );

        // Step 4: the raw ledger (getAppliedMigrations) must match what the
        // status reporter surfaced, name/group/result for name/group/result
        // — this is the seam no per-unit test checks, since status.test.ts
        // only exercises computeMigrationStatus with hand-built rows.
        const ledgerRows = await readLifecycleLedgerRows();
        expect(ledgerRows.map((row) => row.name)).toEqual([
            '0001-zzz-test-lifecycle-alpha',
            '0002-zzz-test-lifecycle-bravo'
        ]);
        for (const statusEntry of afterRunApplied) {
            const ledgerRow = ledgerRows.find((row) => row.name === statusEntry.name);
            expect(ledgerRow).toBeDefined();
            expect(ledgerRow?.group).toBe(statusEntry.group);
            expect(ledgerRow?.result).toBe(statusEntry.result);
            expect(ledgerRow?.checksum).toMatch(/^[0-9a-f]{64}$/);
        }

        // The scratch table proves each up() ran exactly once, in order.
        expect(await readScratchNames()).toEqual([
            '0001-zzz-test-lifecycle-alpha',
            '0002-zzz-test-lifecycle-bravo'
        ]);
    });

    it('rolls back a failing migration so status and ledger agree it (and its unattempted successor) are still pending', async () => {
        const before = await getMigrationStatus({ db: getDb(), dir: ABORT_DIR });
        expect(scopedApplied(before)).toHaveLength(0);
        expect(before.pendingCount).toBe(3);

        await expect(
            runMigrations({ db: getDb(), dir: ABORT_DIR, actor: STUB_ACTOR })
        ).rejects.toThrow(/0002-zzz-test-lifecycle-abort-throws/);

        const after = await getMigrationStatus({ db: getDb(), dir: ABORT_DIR });
        const afterApplied = scopedApplied(after);

        // The seam: only the migration that committed before the failure is
        // applied; the failing one and its never-attempted successor are
        // BOTH still pending, per getMigrationStatus — matching the ledger
        // rollback the runner performed.
        expect(afterApplied).toHaveLength(1);
        expect(afterApplied.map((entry) => entry.name)).toEqual([
            '0001-zzz-test-lifecycle-abort-ok'
        ]);
        expect(after.pendingCount).toBe(2);
        expect(after.pending.map((entry) => entry.name)).toEqual([
            '0002-zzz-test-lifecycle-abort-throws',
            '0003-zzz-test-lifecycle-abort-never'
        ]);

        // Cross-check against the raw ledger directly: it must contain
        // exactly the one committed row, nothing for the failed/never ones.
        const ledgerRows = await readLifecycleLedgerRows();
        expect(ledgerRows.map((row) => row.name)).toEqual(['0001-zzz-test-lifecycle-abort-ok']);

        // The failing migration's own insert was rolled back with its
        // transaction, and the never-attempted migration's up() never ran
        // at all (batch aborted at the first failure — HOS-25 G-5).
        expect(await readScratchNames()).toEqual(['0001-zzz-test-lifecycle-abort-ok']);
    });

    it('baseline-stamps every pending migration so status/ledger agree, without ever running up()', async () => {
        const before = await getMigrationStatus({ db: getDb(), dir: BASELINE_DIR });
        expect(scopedApplied(before)).toHaveLength(0);
        expect(before.pendingCount).toBe(2);

        const stampResult = await baselineStamp({ db: getDb(), dir: BASELINE_DIR });
        expect(stampResult.stamped).toEqual([
            '0001-zzz-test-lifecycle-baseline-alpha',
            '0002-zzz-test-lifecycle-baseline-bravo'
        ]);

        const after = await getMigrationStatus({ db: getDb(), dir: BASELINE_DIR });
        const afterApplied = scopedApplied(after);
        expect(afterApplied).toHaveLength(2);
        expect(after.pendingCount).toBe(0);
        expect(afterApplied.map((entry) => entry.name)).toEqual(stampResult.stamped);
        for (const entry of afterApplied) {
            expect(entry.result).toBe('baseline-stamp');
        }

        // The ledger must reflect the exact same result marker and a zero
        // duration — the seam between baselineStamp's writer and both
        // getMigrationStatus and getAppliedMigrations's readers.
        const ledgerRows = await readLifecycleLedgerRows();
        expect(ledgerRows.map((row) => row.name)).toEqual(stampResult.stamped);
        for (const row of ledgerRows) {
            expect(row.result).toBe('baseline-stamp');
            expect(row.durationMs).toBe(0);
            expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        }

        // up() was never invoked for either fixture: the scratch table each
        // one WOULD have written to stays completely empty.
        expect(await readScratchNames()).toEqual([]);
    });

    it('discovers the real data-migrations directory read-only, staying consistent with getMigrationStatus', async () => {
        // Read-only sanity check against the REAL data-migrations directory
        // (no `dir` override, no ledger writes): the ported billing-plans
        // migrations (T-020) must still be discoverable, in numeric order,
        // as a valid SeedMigrationModule set.
        const discovered = await discoverMigrationFiles({});
        expect(discovered.length).toBeGreaterThanOrEqual(3);

        const firstThree = discovered.slice(0, 3).map((migration) => migration.name);
        expect(firstThree).toEqual([
            '0001-billing-plans-ai-consumer-search-limits',
            '0002-billing-plans-collections-limit',
            '0003-hos16-deactivate-complex-plans'
        ]);
        for (const migration of discovered.slice(0, 3)) {
            expect(migration.meta.group).toBe('required');
        }

        // Cross-check against the real (unscoped) status report: every name
        // it lists as applied-or-pending must come from this same
        // discovered set — the two never diverge on WHICH migrations exist,
        // only on which of them the ledger has recorded yet.
        const discoveredNames = new Set(discovered.map((migration) => migration.name));
        const status = await getMigrationStatus({ db: getDb() });

        for (const pendingEntry of status.pending) {
            expect(discoveredNames.has(pendingEntry.name)).toBe(true);
        }
        for (const appliedEntry of status.applied) {
            // Orphaned rows are the one documented exception: a ledger row
            // whose file no longer exists on disk is, by definition, absent
            // from `discoveredNames` — that is exactly what `orphaned` means.
            if (!appliedEntry.orphaned) {
                expect(discoveredNames.has(appliedEntry.name)).toBe(true);
            }
        }
    });
});
