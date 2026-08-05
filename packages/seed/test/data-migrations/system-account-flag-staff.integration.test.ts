/**
 * @fileoverview
 * Integration tests for `0039-system-account-flag-staff.ts` (HOS-375 T-005).
 *
 * Runs against the REAL integration database, using the rollback-isolation
 * idiom established by
 * `test/data-migrations/raise-commerce-listing-price-to-15000.integration.test.ts`:
 * every test opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside it, then unconditionally throws a sentinel
 * `RollbackSignal` so no `users` row survives the suite.
 *
 * A real database rather than a stubbed `ctx.db` on purpose: this migration IS
 * a single `UPDATE ... WHERE email IN (...) AND is_system_account = false`, so
 * a stub would only assert that a fluent chain was written, never that the
 * predicate selects the right rows and leaves everything else alone. The
 * `WHERE` is the whole migration.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { eq, getDb, inArray, initializeDb, resetDb, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as systemAccountFlagStaff from '../../src/data-migrations/0039-system-account-flag-staff.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const SUPER_ADMIN_EMAIL = 'superadmin@hospeda.com';
const ADMIN_EMAIL = 'admin@hospeda.com';
/** A real person who happens to hold a staff role — must never be flagged. */
const EDITOR_EMAIL = 'zzz-test-hos375-editor@example.test';

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos375-system-account-flag',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return {
        db: tx,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

/** Inserts one user with the given email and system-account flag. */
async function insertUser(
    tx: DrizzleClient,
    email: string,
    isSystemAccount: boolean
): Promise<void> {
    await tx.insert(users).values({ email, isSystemAccount });
}

/** Reads the system-account flag for one email. */
async function readFlag(tx: DrizzleClient, email: string): Promise<boolean | undefined> {
    const rows = await tx
        .select({ isSystemAccount: users.isSystemAccount })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return rows[0]?.isSystemAccount;
}

/** Removes any leftover row for the three emails this suite writes. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx
        .delete(users)
        .where(inArray(users.email, [SUPER_ADMIN_EMAIL, ADMIN_EMAIL, EDITOR_EMAIL]));
}

describe('HOS-375 T-005: 0039-system-account-flag-staff (integration)', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('flags exactly the two staff accounts and leaves a real person alone', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, SUPER_ADMIN_EMAIL, false);
            await insertUser(tx, ADMIN_EMAIL, false);
            await insertUser(tx, EDITOR_EMAIL, false);

            const result = await systemAccountFlagStaff.up(buildCtx(tx));

            expect(result.counts?.accountsFlagged).toBe(2);
            expect(await readFlag(tx, SUPER_ADMIN_EMAIL)).toBe(true);
            expect(await readFlag(tx, ADMIN_EMAIL)).toBe(true);

            // The whole point of a stored flag over a live role check: an
            // account that is a PERSON stays eligible for an author page,
            // whatever role it holds.
            expect(await readFlag(tx, EDITOR_EMAIL)).toBe(false);
        });
    });

    it('is idempotent — a second run flags nothing and changes nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, SUPER_ADMIN_EMAIL, false);
            await insertUser(tx, ADMIN_EMAIL, false);

            const first = await systemAccountFlagStaff.up(buildCtx(tx));
            expect(first.counts?.accountsFlagged).toBe(2);

            const second = await systemAccountFlagStaff.up(buildCtx(tx));

            expect(second.counts?.accountsFlagged).toBe(0);
            expect(await readFlag(tx, SUPER_ADMIN_EMAIL)).toBe(true);
            expect(await readFlag(tx, ADMIN_EMAIL)).toBe(true);
        });
    });

    it('is a silent no-op in an environment where the staff accounts do not exist', async () => {
        // A production database bootstrapped with `--required --exclude=users`
        // never creates these two accounts. The migration must skip, not fail —
        // a throw here would abort the whole batch (HOS-25 G-5) for a condition
        // that is entirely legitimate.
        await withRollback(async (tx) => {
            await clearTargets(tx);

            const result = await systemAccountFlagStaff.up(buildCtx(tx));

            expect(result.counts?.accountsFlagged).toBe(0);
            expect(result.summary).toMatch(/absent from this environment/);
        });
    });

    it('does not rewrite an account an operator already flagged', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, SUPER_ADMIN_EMAIL, true);
            await insertUser(tx, ADMIN_EMAIL, false);

            const result = await systemAccountFlagStaff.up(buildCtx(tx));

            // Only the one still at `false` is written; the already-true row is
            // excluded by the predicate rather than re-set to the same value.
            expect(result.counts?.accountsFlagged).toBe(1);
            // Note `'superadmin@hospeda.com'.includes('admin@hospeda.com')` is
            // TRUE, so a bare `toContain(ADMIN_EMAIL)` would pass even if the
            // wrong row had been flagged. The negative assertion is what pins it.
            expect(result.summary).not.toContain(SUPER_ADMIN_EMAIL);
            expect(result.summary).toMatch(/Marked 1 staff account\(s\)/);
            expect(await readFlag(tx, SUPER_ADMIN_EMAIL)).toBe(true);
            expect(await readFlag(tx, ADMIN_EMAIL)).toBe(true);
        });
    });
});
