/**
 * @fileoverview
 * Tests for the ledger read/write layer (HOS-25, T-004):
 * {@link getAppliedMigrations}, {@link recordApplied}, {@link computeChecksum}.
 *
 * Split in two:
 *
 * - `computeChecksum` — pure unit tests, no DB involved.
 * - `getAppliedMigrations` / `recordApplied` — integration round-trip against
 *   the REAL worktree PostgreSQL database, mirroring the convention already
 *   established by `test/data-migrations/fkGuard.test.ts` (T-006):
 *   `packages/seed` has no dedicated disposable-DB harness (unlike
 *   `packages/db/test/integration/`), so this wires a minimal `pg` `Pool` +
 *   `@repo/db`'s `initializeDb()` directly, loading `HOSPEDA_DATABASE_URL`
 *   from `apps/api/.env.local` (the same env-loading convention
 *   `packages/seed/src/index.ts` and `fkGuard.test.ts` already use). In this
 *   worktree that variable points at the isolated `worktree_*` database.
 *
 * Every row this file writes uses a `zzz-test-ledger-` name prefix so it is
 * trivially greppable and can never collide with a real migration name, and
 * is deleted again in `afterEach` — this test never leaves state behind in
 * the shared worktree ledger.
 *
 * `seedMigrations` is imported from the narrower `@repo/db/schemas` subpath
 * (not the top-level `@repo/db` barrel): statically importing it (or the
 * unrelated `qzpaySchema`) through the full barrel intermittently resolves
 * to `undefined` under Vitest's Vite-based SSR module runner — reproducible
 * in isolation with no other imports involved, but the exact same symbol
 * resolves correctly via the `@repo/db/schemas` subpath, via a dynamic
 * `import('@repo/db')`, and via `tsx` at real runtime (verified against
 * `ledger.ts` itself, which imports `seedMigrations` from the full barrel and
 * works correctly in production). This looks like a Vitest/Vite module-runner
 * limitation with deeply-indirected `export *` re-export chains, not a bug in
 * `@repo/db` or in this test — `getDb`/`initializeDb`/`resetDb` (only one
 * level of re-export indirection, from `client.ts`) are unaffected and kept
 * on the top-level barrel import, matching `fkGuard.test.ts`'s convention.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, initializeDb, resetDb } from '@repo/db';
import { seedMigrations } from '@repo/db/schemas';
import { config as loadEnv } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    computeChecksum,
    getAppliedMigrations,
    recordApplied
} from '../../src/data-migrations/ledger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts and
// test/data-migrations/fkGuard.test.ts: HOSPEDA_DATABASE_URL lives in
// apps/api/.env.local, not in a (nonexistent) packages/seed env file.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const TEST_NAME_PREFIX = 'zzz-test-ledger-';

/** Builds a fresh, collision-free test migration name for one test case. */
function testMigrationName(): string {
    return `${TEST_NAME_PREFIX}${crypto.randomUUID()}`;
}

describe('computeChecksum', () => {
    it('produces a stable hash for identical input', () => {
        const contents = 'export const meta = { name: "0001-sample", group: "required" };';

        const first = computeChecksum({ contents });
        const second = computeChecksum({ contents });

        expect(first).toBe(second);
    });

    it('produces a different hash for different input', () => {
        const a = computeChecksum({ contents: 'content A' });
        const b = computeChecksum({ contents: 'content B' });

        expect(a).not.toBe(b);
    });

    it('returns a lowercase 64-char hex string (SHA-256 digest length)', () => {
        const digest = computeChecksum({ contents: 'anything' });

        expect(digest).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('getAppliedMigrations / recordApplied (integration, real worktree DB)', () => {
    let pool: Pool;

    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterEach(async () => {
        const db = getDb();
        // Namespaced cleanup: only ever deletes rows this file itself created.
        await db.execute(
            sql`DELETE FROM ${seedMigrations} WHERE ${seedMigrations.name} LIKE ${`${TEST_NAME_PREFIX}%`}`
        );
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('records zero applied migrations for a name that was never inserted', async () => {
        const { names } = await getAppliedMigrations({ db: getDb() });

        expect(names.has('this-name-does-not-exist')).toBe(false);
    });

    it('round-trips a single recorded migration through getAppliedMigrations', async () => {
        const name = testMigrationName();
        const checksum = computeChecksum({ contents: `contents for ${name}` });

        await recordApplied({
            db: getDb(),
            name,
            group: 'required',
            checksum,
            durationMs: 42,
            result: 'ok'
        });

        const { names, rows } = await getAppliedMigrations({ db: getDb() });

        expect(names.has(name)).toBe(true);

        const row = rows.find((r) => r.name === name);
        expect(row).toBeDefined();
        expect(row?.group).toBe('required');
        expect(row?.checksum).toBe(checksum);
        expect(row?.durationMs).toBe(42);
        expect(row?.result).toBe('ok');
        expect(row?.appliedAt).toBeInstanceOf(Date);
    });

    it('records a baseline-stamp row with the example group', async () => {
        const name = testMigrationName();

        await recordApplied({
            db: getDb(),
            name,
            group: 'example',
            checksum: computeChecksum({ contents: 'baseline contents' }),
            durationMs: 0,
            result: 'baseline-stamp'
        });

        const { rows } = await getAppliedMigrations({ db: getDb() });
        const row = rows.find((r) => r.name === name);

        expect(row?.group).toBe('example');
        expect(row?.result).toBe('baseline-stamp');
    });

    it('is safe to call recordApplied inside an existing transaction', async () => {
        const name = testMigrationName();
        const checksum = computeChecksum({ contents: `tx contents for ${name}` });

        await getDb().transaction(async (tx) => {
            await recordApplied({
                db: tx,
                name,
                group: 'required',
                checksum,
                durationMs: 7,
                result: 'ok'
            });
        });

        const rowsAfterCommit = await getDb()
            .select()
            .from(seedMigrations)
            .where(eq(seedMigrations.name, name));
        expect(rowsAfterCommit).toHaveLength(1);
    });

    it('rolls back the ledger row when the enclosing transaction throws', async () => {
        const name = testMigrationName();

        await expect(
            getDb().transaction(async (tx) => {
                await recordApplied({
                    db: tx,
                    name,
                    group: 'required',
                    checksum: computeChecksum({ contents: 'will be rolled back' }),
                    durationMs: 1,
                    result: 'ok'
                });
                throw new Error('simulated migration failure');
            })
        ).rejects.toThrow('simulated migration failure');

        const { names } = await getAppliedMigrations({ db: getDb() });
        expect(names.has(name)).toBe(false);
    });
});
