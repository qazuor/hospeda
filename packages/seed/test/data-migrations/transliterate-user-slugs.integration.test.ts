/**
 * @fileoverview
 * Integration tests for `0043-transliterate-user-slugs.ts` (HOS-375).
 *
 * Runs against the REAL integration database, using the rollback-isolation
 * idiom established by
 * `test/data-migrations/editorial-author-slug.integration.test.ts`: every
 * test opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside it, then unconditionally throws a sentinel
 * `RollbackSignal` so no `users` row survives the suite.
 *
 * A real database rather than a stubbed `ctx.db` on purpose: what this
 * migration has to get right is the raw Postgres `!~` regex selection
 * against `users.slug`'s real `UNIQUE` constraint — a stub would assert that
 * a fluent chain was written, not that the right rows moved and a genuine
 * collision was caught.
 *
 * Unlike `0040` (scoped to one email), this migration selects EVERY
 * non-conforming row in the table by design (see its docblock). Running
 * against the worktree's real dev DB — which may itself carry legacy
 * non-conforming rows depending on whether `0043` has already applied there —
 * would make `slugsRewritten` counts non-deterministic. Every test therefore
 * calls {@link clearAllNonConformingSlugs} right after {@link clearTargets} to
 * establish a genuinely clean baseline inside its own rolled-back
 * transaction, before inserting the rows the test itself cares about.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { eq, getDb, inArray, initializeDb, resetDb, sql, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as transliterateUserSlugs from '../../src/data-migrations/0043-transliterate-user-slugs.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Emails used by this suite; never collide with real seeded data. */
const ANA_EMAIL = 'zzz-test-hos375-ana@example.test';
const CARLOS_EMAIL = 'zzz-test-hos375-carlos@example.test';
const CONFORMING_EMAIL = 'zzz-test-hos375-conforming@example.test';
const BYSTANDER_EMAIL = 'zzz-test-hos375-bystander@example.test';

const ALL_TEST_EMAILS = [ANA_EMAIL, CARLOS_EMAIL, CONFORMING_EMAIL, BYSTANDER_EMAIL];

/** Slugs this suite writes or expects, cleaned up alongside the emails. */
const ALL_TEST_SLUGS = [
    'ana-rodríguez',
    'ana-rodriguez',
    'carlos-martínez',
    'carlos-martinez',
    'zzz-test-hos375-conforming',
    'zzz-test-hos375-bystander'
];

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos375-transliterate-user-slugs',
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

/** Inserts one user with an explicit email + slug. */
async function insertUser(tx: DrizzleClient, email: string, slug: string): Promise<void> {
    await tx.insert(users).values({ email, slug });
}

/** Reads the slug for one email. */
async function readSlug(tx: DrizzleClient, email: string): Promise<string | undefined> {
    const rows = await tx
        .select({ slug: users.slug })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return rows[0]?.slug;
}

/** Removes any leftover row this suite writes, by email or by target slug. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, ALL_TEST_EMAILS));
    await tx.delete(users).where(inArray(users.slug, ALL_TEST_SLUGS));
}

/**
 * Deletes every row in the (transaction-scoped) table whose slug does not
 * conform — the same predicate the migration itself selects on. Establishes
 * a deterministic "no non-conforming rows exist" baseline regardless of
 * whatever state the shared worktree dev DB happens to be in, without ever
 * touching data outside this rolled-back transaction.
 */
async function clearAllNonConformingSlugs(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(sql`${users.slug} !~ '^[a-z0-9]+(?:[_-][a-z0-9]+)*$'`);
}

describe('HOS-375: 0043-transliterate-user-slugs (integration)', () => {
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

    it('transliterates a non-ASCII slug to its ASCII-conforming equivalent', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearAllNonConformingSlugs(tx);
            await insertUser(tx, ANA_EMAIL, 'ana-rodríguez');
            await insertUser(tx, CARLOS_EMAIL, 'carlos-martínez');

            const result = await transliterateUserSlugs.up(buildCtx(tx));

            expect(result.counts?.slugsRewritten).toBe(2);
            expect(await readSlug(tx, ANA_EMAIL)).toBe('ana-rodriguez');
            expect(await readSlug(tx, CARLOS_EMAIL)).toBe('carlos-martinez');
        });
    });

    it('leaves an already-conforming slug untouched', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearAllNonConformingSlugs(tx);
            await insertUser(tx, CONFORMING_EMAIL, 'zzz-test-hos375-conforming');

            const result = await transliterateUserSlugs.up(buildCtx(tx));

            expect(result.counts?.slugsRewritten).toBe(0);
            expect(await readSlug(tx, CONFORMING_EMAIL)).toBe('zzz-test-hos375-conforming');
        });
    });

    it('is idempotent — a second run rewrites nothing and changes nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearAllNonConformingSlugs(tx);
            await insertUser(tx, ANA_EMAIL, 'ana-rodríguez');

            const first = await transliterateUserSlugs.up(buildCtx(tx));
            expect(first.counts?.slugsRewritten).toBe(1);

            const second = await transliterateUserSlugs.up(buildCtx(tx));

            expect(second.counts?.slugsRewritten).toBe(0);
            expect(second.summary).toMatch(/No non-conforming user slugs found/);
            expect(await readSlug(tx, ANA_EMAIL)).toBe('ana-rodriguez');
        });
    });

    it('throws on a collision with a different row instead of skipping or clobbering', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearAllNonConformingSlugs(tx);
            await insertUser(tx, ANA_EMAIL, 'ana-rodríguez');
            // A different row already sits on the exact target the transliteration
            // would produce.
            await insertUser(tx, BYSTANDER_EMAIL, 'ana-rodriguez');

            await expect(transliterateUserSlugs.up(buildCtx(tx))).rejects.toThrow(
                /already holds that slug/
            );

            // Neither row was touched — the migration stops before writing.
            expect(await readSlug(tx, ANA_EMAIL)).toBe('ana-rodríguez');
            expect(await readSlug(tx, BYSTANDER_EMAIL)).toBe('ana-rodriguez');
        });
    });

    it('no-ops on an empty database (no non-conforming rows at all)', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearAllNonConformingSlugs(tx);

            const result = await transliterateUserSlugs.up(buildCtx(tx));

            expect(result.counts?.slugsRewritten).toBe(0);
            expect(result.summary).toMatch(/No non-conforming user slugs found/);
        });
    });
});
