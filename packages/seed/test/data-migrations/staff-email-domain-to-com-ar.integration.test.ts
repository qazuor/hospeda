/**
 * @fileoverview
 * Integration tests for `0057-staff-email-domain-to-com-ar.ts` (H-76).
 *
 * Runs against the REAL integration database using the rollback-isolation
 * idiom of `system-account-flag-staff.integration.test.ts`: every test opens a
 * `db.transaction()`, does setup + `up()` + assertions inside it, then throws a
 * sentinel to roll the whole thing back.
 *
 * A real database rather than a stubbed `ctx.db`, for the same reason as its
 * neighbour and then some. This migration IS its SQL: a `NOT EXISTS` guard
 * against a UNIQUE constraint, and a nested `jsonb_set` with
 * `create_missing = false`. A stub could only assert that a fluent chain was
 * written — it could not tell whether the collision guard actually prevents the
 * constraint violation, nor whether the JSON rewrite leaves an absent key
 * absent. Those two behaviours are the entire risk surface.
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
import * as migration from '../../src/data-migrations/0057-staff-email-domain-to-com-ar.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Prefixed so a leftover row is obvious and cannot collide with real data. */
const SUPER_ADMIN = 'zzqa-h76-superadmin@hospeda.com';
const ADMIN = 'zzqa-h76-admin@hospeda.com';
const GUEST = 'zzqa-h76-guest@hospeda.com';
/** Already on the right domain — must not be touched, and must not double up. */
const ALREADY_OK = 'zzqa-h76-ok@hospeda.com.ar';
/** A different domain entirely — must not be touched. */
const OUTSIDER = 'zzqa-h76-outsider@example.test';
/** Used by the collision case: the target address already exists. */
const TWIN_OLD = 'zzqa-h76-twin@hospeda.com';
const TWIN_NEW = 'zzqa-h76-twin@hospeda.com.ar';

const ALL_TEST_EMAILS = [
    SUPER_ADMIN,
    ADMIN,
    GUEST,
    ALREADY_OK,
    OUTSIDER,
    TWIN_OLD,
    TWIN_NEW,
    `${SUPER_ADMIN}.ar`,
    `${ADMIN}.ar`,
    `${GUEST}.ar`
];

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-h76-staff-email-domain',
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

/** Inserts one user, optionally with a contact block. */
async function insertUser(
    tx: DrizzleClient,
    email: string,
    contactInfo?: Record<string, unknown>
): Promise<void> {
    await tx.insert(users).values(
        contactInfo === undefined
            ? { email }
            : // biome-ignore lint/suspicious/noExplicitAny: the contact block is a free-form JSONB payload in this fixture.
              ({ email, contactInfo } as any)
    );
}

/** Reads the contact block for one email. */
async function readContact(
    tx: DrizzleClient,
    email: string
): Promise<Record<string, unknown> | undefined> {
    const rows = await tx
        .select({ contactInfo: users.contactInfo })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return rows[0]?.contactInfo as Record<string, unknown> | undefined;
}

/** True when a row with this exact email exists. */
async function exists(tx: DrizzleClient, email: string): Promise<boolean> {
    const rows = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    return rows.length > 0;
}

/** Removes any leftover row this suite writes. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, ALL_TEST_EMAILS));
}

describe('H-76: 0057-staff-email-domain-to-com-ar (integration)', () => {
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

    it('moves every @hospeda.com account to @hospeda.com.ar and leaves the rest alone', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            for (const email of [SUPER_ADMIN, ADMIN, GUEST, ALREADY_OK, OUTSIDER]) {
                await insertUser(tx, email);
            }

            await migration.up(buildCtx(tx));

            expect(await exists(tx, `${SUPER_ADMIN}.ar`)).toBe(true);
            expect(await exists(tx, `${ADMIN}.ar`)).toBe(true);
            expect(await exists(tx, `${GUEST}.ar`)).toBe(true);
            // The old addresses are gone, not duplicated.
            expect(await exists(tx, SUPER_ADMIN)).toBe(false);
            expect(await exists(tx, ADMIN)).toBe(false);
            expect(await exists(tx, GUEST)).toBe(false);
            // An address already on the right domain must not gain a second
            // `.ar`, and an unrelated domain must not be touched at all.
            expect(await exists(tx, ALREADY_OK)).toBe(true);
            expect(await exists(tx, `${ALREADY_OK}.ar`)).toBe(false);
            expect(await exists(tx, OUTSIDER)).toBe(true);
        });
    });

    it('rewrites the contact block without inventing a key that was absent', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, SUPER_ADMIN, {
                personalEmail: SUPER_ADMIN,
                workEmail: ADMIN,
                preferredEmail: 'WORK',
                mobilePhone: '+5493442000000'
            });
            // Only a personal address — `workEmail` must stay absent.
            await insertUser(tx, GUEST, {
                personalEmail: GUEST,
                preferredEmail: 'PERSONAL'
            });

            await migration.up(buildCtx(tx));

            const superContact = await readContact(tx, `${SUPER_ADMIN}.ar`);
            expect(superContact?.personalEmail).toBe(`${SUPER_ADMIN}.ar`);
            expect(superContact?.workEmail).toBe(`${ADMIN}.ar`);
            // A channel selector, not an address — it must survive untouched.
            expect(superContact?.preferredEmail).toBe('WORK');
            expect(superContact?.mobilePhone).toBe('+5493442000000');

            const guestContact = await readContact(tx, `${GUEST}.ar`);
            expect(guestContact?.personalEmail).toBe(`${GUEST}.ar`);
            // `create_missing = false` is the whole point: no empty workEmail.
            expect('workEmail' in (guestContact ?? {})).toBe(false);
        });
    });

    it('leaves a row alone when its target address is already taken', async () => {
        // `users.email` is UNIQUE. Without the NOT EXISTS guard this case does
        // not "skip a row" — it aborts the entire migration run on a constraint
        // violation, taking every later migration with it.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, TWIN_OLD);
            await insertUser(tx, TWIN_NEW);

            const result = await migration.up(buildCtx(tx));

            expect(await exists(tx, TWIN_OLD)).toBe(true);
            expect(await exists(tx, TWIN_NEW)).toBe(true);
            expect(result.counts?.accountsRenamed).toBe(0);
        });
    });

    it('is idempotent: a second run changes nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, SUPER_ADMIN, {
                personalEmail: SUPER_ADMIN,
                workEmail: ADMIN
            });

            const first = await migration.up(buildCtx(tx));
            expect(first.counts?.accountsRenamed).toBe(1);
            expect(first.counts?.profilesUpdated).toBe(1);

            const second = await migration.up(buildCtx(tx));
            expect(second.counts?.accountsRenamed).toBe(0);
            expect(second.counts?.profilesUpdated).toBe(0);

            const contact = await readContact(tx, `${SUPER_ADMIN}.ar`);
            // The telling failure would be a double suffix here.
            expect(contact?.personalEmail).toBe(`${SUPER_ADMIN}.ar`);
            expect(contact?.workEmail).toBe(`${ADMIN}.ar`);
        });
    });
});
