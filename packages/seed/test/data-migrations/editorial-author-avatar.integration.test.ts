/**
 * @fileoverview
 * Integration tests for `0042-editorial-author-avatar.ts` (HOS-375).
 *
 * Same rollback-isolation idiom as
 * `test/data-migrations/editorial-author-slug.integration.test.ts`: every test
 * opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client, runs setup + `up()` + assertions inside it, then
 * throws a sentinel `RollbackSignal` so no `users` row survives.
 *
 * A real database rather than a stubbed `ctx.db`, for one specific reason:
 * `profile` is a JSONB column that ALSO holds the bio, and the thing most
 * likely to go wrong here is writing `{ avatar }` wholesale and silently
 * dropping it. Against a stub that bug asserts as "a fluent chain was called".
 * Against Postgres it asserts as a missing bio — which is what it really is,
 * and which would leave the author page `noindex` for a different reason while
 * destroying production copy.
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
import * as editorialAuthorAvatar from '../../src/data-migrations/0042-editorial-author-avatar.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * The value the migration writes. Re-declared rather than imported so the test
 * fails if the migration's constant changes — that URL is a production-visible
 * decision (it is what Google renders next to the byline), not an internal
 * detail, and it should not be able to drift silently.
 */
const EXPECTED_AVATAR =
    'https://res.cloudinary.com/djqdu6u93/image/upload/f_auto,q_auto,w_192,h_192,c_fill/' +
    'v1783526697/hospeda/prod/avatars/5748fbbd-7b13-4c65-b545-5510e106b0a5.png';

/** The bio `0025` writes. Only its survival matters here, not its exact text. */
const EDITORIAL_BIO = 'Somos el equipo editorial de Hospeda.';

/** An unrelated account that must never be touched. */
const BYSTANDER_EMAIL = 'zzz-test-hos375-avatar-bystander@example.test';
const BYSTANDER_SLUG = 'zzz-test-hos375-avatar-bystander';

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos375-editorial-author-avatar',
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

/** Inserts one user with an explicit profile. */
async function insertUser(
    tx: DrizzleClient,
    email: string,
    slug: string,
    profile: Record<string, unknown> | null
): Promise<void> {
    await tx.insert(users).values({ email, slug, ...(profile ? { profile } : {}) });
}

/** Reads the whole profile object for one email. */
async function readProfile(
    tx: DrizzleClient,
    email: string
): Promise<Record<string, unknown> | undefined> {
    const rows = await tx
        .select({ profile: users.profile })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return rows[0]?.profile as Record<string, unknown> | undefined;
}

/** Removes any leftover row for the emails this suite writes. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, [EDITORIAL_EMAIL, BYSTANDER_EMAIL]));
    await tx.delete(users).where(inArray(users.slug, ['equipo-hospeda', BYSTANDER_SLUG]));
}

describe('HOS-375: 0042-editorial-author-avatar (integration)', () => {
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

    it('sets the avatar AND leaves the bio intact', async () => {
        // The whole reason this suite hits a real database. `profile` is one
        // JSONB column holding both keys; a wholesale write would take the bio
        // with it and swap a missing-avatar exclusion for a missing-bio one.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', { bio: EDITORIAL_BIO });

            const result = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(result.counts?.avatarsSet).toBe(1);

            const profile = await readProfile(tx, EDITORIAL_EMAIL);
            expect(profile?.avatar).toBe(EXPECTED_AVATAR);
            expect(profile?.bio).toBe(EDITORIAL_BIO);
        });
    });

    it('preserves every other profile key, not just the bio', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', {
                bio: EDITORIAL_BIO,
                occupation: 'Editorial',
                birthDate: '2020-01-01'
            });

            await editorialAuthorAvatar.up(buildCtx(tx));

            const profile = await readProfile(tx, EDITORIAL_EMAIL);
            expect(profile?.avatar).toBe(EXPECTED_AVATAR);
            expect(profile?.bio).toBe(EDITORIAL_BIO);
            expect(profile?.occupation).toBe('Editorial');
            expect(profile?.birthDate).toBe('2020-01-01');
        });
    });

    it('resolves by email, not by slug — and works from any slug', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            // Deliberately NOT the curated slug: nothing may depend on `0040`
            // having already run.
            await insertUser(tx, EDITORIAL_EMAIL, 'user-ffffffff', { bio: EDITORIAL_BIO });

            const result = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(result.counts?.avatarsSet).toBe(1);
            expect((await readProfile(tx, EDITORIAL_EMAIL))?.avatar).toBe(EXPECTED_AVATAR);
        });
    });

    it('never overwrites an avatar someone else already set', async () => {
        // Unlike the slug migration, the value being replaced here would be a
        // deliberate human choice, not a machine-generated string. The goal is
        // "the account has an avatar", which is already met.
        const OPERATOR_AVATAR = 'https://cdn.example.test/operator-chosen.png';

        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', {
                bio: EDITORIAL_BIO,
                avatar: OPERATOR_AVATAR
            });

            const result = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(result.counts?.avatarsSet).toBe(0);
            expect(result.summary).toContain('leaving it untouched');
            expect((await readProfile(tx, EDITORIAL_EMAIL))?.avatar).toBe(OPERATOR_AVATAR);
        });
    });

    it('treats a blank avatar as absent and fills it', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', {
                bio: EDITORIAL_BIO,
                avatar: '   '
            });

            const result = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(result.counts?.avatarsSet).toBe(1);
            expect((await readProfile(tx, EDITORIAL_EMAIL))?.avatar).toBe(EXPECTED_AVATAR);
        });
    });

    it('is idempotent — a second run writes nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', { bio: EDITORIAL_BIO });

            const first = await editorialAuthorAvatar.up(buildCtx(tx));
            expect(first.counts?.avatarsSet).toBe(1);

            const second = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(second.counts?.avatarsSet).toBe(0);
            expect(second.summary).toContain('already carries the Hospeda isotype');
            expect((await readProfile(tx, EDITORIAL_EMAIL))?.bio).toBe(EDITORIAL_BIO);
        });
    });

    it('no-ops cleanly when the editorial account does not exist', async () => {
        // A fresh environment that has not run `0025` yet, or one that never
        // will. Must not throw and must not touch anyone else.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, BYSTANDER_EMAIL, BYSTANDER_SLUG, { bio: 'unrelated' });

            const result = await editorialAuthorAvatar.up(buildCtx(tx));

            expect(result.counts?.avatarsSet).toBe(0);
            expect(result.summary).toContain('absent from this environment');
            expect(await readProfile(tx, BYSTANDER_EMAIL)).toEqual({ bio: 'unrelated' });
        });
    });

    it('leaves unrelated accounts alone when it does write', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL, 'equipo-hospeda', { bio: EDITORIAL_BIO });
            await insertUser(tx, BYSTANDER_EMAIL, BYSTANDER_SLUG, { bio: 'unrelated' });

            await editorialAuthorAvatar.up(buildCtx(tx));

            expect(await readProfile(tx, BYSTANDER_EMAIL)).toEqual({ bio: 'unrelated' });
        });
    });
});
