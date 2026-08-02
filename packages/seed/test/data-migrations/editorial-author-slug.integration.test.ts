/**
 * @fileoverview
 * Integration tests for `0035-editorial-author-slug.ts` (HOS-375 T-006).
 *
 * Runs against the REAL integration database, using the rollback-isolation
 * idiom established by
 * `test/data-migrations/raise-commerce-listing-price-to-15000.integration.test.ts`:
 * every test opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside it, then unconditionally throws a sentinel
 * `RollbackSignal` so no `users` row survives the suite.
 *
 * A real database rather than a stubbed `ctx.db` on purpose: what this
 * migration has to get right is that it resolves the account by EMAIL and never
 * by slug or id — and that `users.slug`'s `UNIQUE` constraint and its random
 * `$defaultFn` behave as assumed. A stub would assert that a fluent chain was
 * written, not that the right row moved.
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
import * as editorialAuthorSlug from '../../src/data-migrations/0035-editorial-author-slug.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';
const EDITORIAL_SLUG = 'equipo-hospeda';

/**
 * Stands in for the per-environment auto-slug `users.slug.$defaultFn` produces
 * (`user-95c2cd4b` in production, `user-76eb2960` locally). Deliberately not
 * either real value: nothing in the migration may depend on knowing it.
 */
const AUTO_SLUG = 'user-0bad51u9';

/** An unrelated account, used both as a bystander and as a slug squatter. */
const BYSTANDER_EMAIL = 'zzz-test-hos375-bystander@example.test';

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos375-editorial-author-slug',
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

/** Removes any leftover row for the emails this suite writes. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, [EDITORIAL_EMAIL, BYSTANDER_EMAIL]));
    await tx.delete(users).where(inArray(users.slug, [EDITORIAL_SLUG, AUTO_SLUG]));
}

describe('HOS-375 T-006: 0035-editorial-author-slug (integration)', () => {
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

    it('resolves the account by email and renames its auto-slug', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, AUTO_SLUG);
            await insertUser(tx, BYSTANDER_EMAIL, 'zzz-test-hos375-bystander');

            const result = await editorialAuthorSlug.up(buildCtx(tx));

            expect(result.counts?.accountsRenamed).toBe(1);
            expect(await readSlug(tx, EDITORIAL_EMAIL)).toBe(EDITORIAL_SLUG);
            // The migration knows nothing about the previous slug beyond what it
            // read: an unrelated account keeps its own.
            expect(await readSlug(tx, BYSTANDER_EMAIL)).toBe('zzz-test-hos375-bystander');
        });
    });

    it('works from ANY starting auto-slug — nothing is hardcoded', async () => {
        // The production and local auto-slugs differ (`user-95c2cd4b` vs
        // `user-76eb2960`). Feeding a third, unrelated value proves the
        // migration selects on email alone.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'user-ffffffff');

            const result = await editorialAuthorSlug.up(buildCtx(tx));

            expect(result.counts?.accountsRenamed).toBe(1);
            expect(result.summary).toContain('user-ffffffff');
            expect(await readSlug(tx, EDITORIAL_EMAIL)).toBe(EDITORIAL_SLUG);
        });
    });

    it('is idempotent — a second run renames nothing and changes nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, AUTO_SLUG);

            const first = await editorialAuthorSlug.up(buildCtx(tx));
            expect(first.counts?.accountsRenamed).toBe(1);

            const second = await editorialAuthorSlug.up(buildCtx(tx));

            expect(second.counts?.accountsRenamed).toBe(0);
            expect(second.summary).toMatch(/already carries the slug/);
            expect(await readSlug(tx, EDITORIAL_EMAIL)).toBe(EDITORIAL_SLUG);
        });
    });

    it('is a silent no-op where the editorial account does not exist', async () => {
        // An environment that has not yet run `0025-seed-real-blog-posts` has no
        // such account. Throwing here would abort the whole batch (HOS-25 G-5)
        // for a legitimate condition.
        await withRollback(async (tx) => {
            await clearTargets(tx);

            const result = await editorialAuthorSlug.up(buildCtx(tx));

            expect(result.counts?.accountsRenamed).toBe(0);
            expect(result.summary).toMatch(/absent from this environment/);
        });
    });

    it('fails loudly when another account already holds the target slug', async () => {
        // `users.slug` is UNIQUE. Skipping would leave the editorial page on its
        // random auto-slug and publish THAT — the exact harm the migration
        // exists to prevent — so it must stop and make an operator look.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, AUTO_SLUG);
            await insertUser(tx, BYSTANDER_EMAIL, EDITORIAL_SLUG);

            await expect(editorialAuthorSlug.up(buildCtx(tx))).rejects.toThrow(
                /already holds that slug/
            );

            // And the editorial account is left exactly as it was found.
            expect(await readSlug(tx, EDITORIAL_EMAIL)).toBe(AUTO_SLUG);
        });
    });
});
