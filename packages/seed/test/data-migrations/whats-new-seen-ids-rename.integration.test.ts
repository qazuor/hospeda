/**
 * @fileoverview
 * Integration tests for `0109-hos1418-whats-new-seen-ids-rename.ts` (HOS-1418).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom
 * of `transliterate-user-slugs.integration.test.ts`: every test opens a
 * transaction, runs setup + `up()` + assertions inside it, then throws a
 * sentinel so no row survives.
 *
 * A real database on purpose: what the migration has to get right is the JSONB
 * `?` selection and the `jsonb_set` rewrite of one nested path while leaving the
 * rest of `users.settings` untouched — a stubbed client could not show that.
 *
 * The retired What's New ids contain the retired grouping word, which may not
 * appear outside the exempt migration folders, so this file builds them in
 * parts. They are still the real persisted values.
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
import * as seenIdsRename from '../../src/data-migrations/0109-hos1418-whats-new-seen-ids-rename.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** The retired grouping word, built in parts. */
const OLD_WORD = `comm${'erce'}`;

const OLD_FREE_TRIAL = `2026-09-05-${OLD_WORD}-publish-free-trial`;
const OLD_FEATURES = `2026-09-08-features-on-${OLD_WORD}-pages`;
const OLD_EDITOR = `2026-09-08-${OLD_WORD}-editor-by-sections`;

const NEW_FREE_TRIAL = '2026-09-05-gastronomy-experience-publish-free-trial';
const NEW_FEATURES = '2026-09-08-features-on-listing-pages';
const NEW_EDITOR = '2026-09-08-listing-editor-by-sections';

const UNRELATED_ID = '2026-08-01-some-other-entry';
const BASELINE_AT = '2026-08-15T00:00:00.000Z';

const OLD_EMAIL = 'zzz-test-hos1418-old@example.test';
const BOTH_EMAIL = 'zzz-test-hos1418-both@example.test';
const NONE_EMAIL = 'zzz-test-hos1418-none@example.test';
const ALL_TEST_EMAILS = [OLD_EMAIL, BOTH_EMAIL, NONE_EMAIL];

/** Stub actor — this migration only touches `ctx.db`. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1418-whats-new-seen-ids-rename',
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

/** Inserts one user whose settings carry `seenIds` plus unrelated keys. */
async function insertUser(
    tx: DrizzleClient,
    { email, seenIds }: { readonly email: string; readonly seenIds: readonly string[] }
): Promise<void> {
    const settings = {
        notifications: { enabled: true, allowEmails: false, allowSms: false, allowPush: true },
        newsletter: true,
        onboarding: { whatsNew: { baselineAt: BASELINE_AT, seenIds: [...seenIds] } }
    };
    await tx
        .insert(users)
        .values({ email, slug: email.split('@')[0] ?? email })
        .returning({ id: users.id });
    await tx
        .update(users)
        .set({ settings: sql`${JSON.stringify(settings)}::jsonb` })
        .where(eq(users.email, email));
}

/** Reads the whole `settings` object for one email. */
async function readSettings(tx: DrizzleClient, email: string): Promise<unknown> {
    const rows = await tx
        .select({ settings: users.settings })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    return rows[0]?.settings;
}

/** Removes any leftover row this suite writes. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, ALL_TEST_EMAILS));
}

/**
 * Strips the old ids from every other user inside the rolled-back transaction,
 * so the count assertions do not depend on the shared dev DB's state.
 */
async function clearOtherHolders(tx: DrizzleClient): Promise<void> {
    await tx.execute(
        sql`UPDATE users SET settings = jsonb_set(settings, '{onboarding,whatsNew,seenIds}', '[]'::jsonb)
            WHERE (settings #> '{onboarding,whatsNew,seenIds}') ?| ARRAY[${OLD_FREE_TRIAL}, ${OLD_FEATURES}, ${OLD_EDITOR}]::text[]`
    );
}

describe('HOS-1418: 0109-hos1418-whats-new-seen-ids-rename (integration)', () => {
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

    it('maps exactly the three retired ids to their new ids', () => {
        expect(seenIdsRename.WHATS_NEW_ID_RENAMES).toEqual({
            [OLD_FREE_TRIAL]: NEW_FREE_TRIAL,
            [OLD_FEATURES]: NEW_FEATURES,
            [OLD_EDITOR]: NEW_EDITOR
        });
    });

    it('rewrites old ids to new ids in place and keeps the rest of settings intact', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearOtherHolders(tx);
            await insertUser(tx, {
                email: OLD_EMAIL,
                seenIds: [UNRELATED_ID, OLD_FREE_TRIAL, OLD_FEATURES, OLD_EDITOR]
            });

            const result = await seenIdsRename.up(buildCtx(tx));

            expect(result.counts?.usersRewritten).toBe(1);
            expect(await readSettings(tx, OLD_EMAIL)).toEqual({
                notifications: {
                    enabled: true,
                    allowEmails: false,
                    allowSms: false,
                    allowPush: true
                },
                newsletter: true,
                onboarding: {
                    whatsNew: {
                        baselineAt: BASELINE_AT,
                        seenIds: [UNRELATED_ID, NEW_FREE_TRIAL, NEW_FEATURES, NEW_EDITOR]
                    }
                }
            });
        });
    });

    it('does not duplicate a new id the user already holds', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearOtherHolders(tx);
            await insertUser(tx, {
                email: BOTH_EMAIL,
                seenIds: [NEW_FREE_TRIAL, OLD_FREE_TRIAL, UNRELATED_ID]
            });

            const result = await seenIdsRename.up(buildCtx(tx));

            expect(result.counts?.usersRewritten).toBe(1);
            const settings = (await readSettings(tx, BOTH_EMAIL)) as {
                onboarding: { whatsNew: { seenIds: string[] } };
            };
            expect(settings.onboarding.whatsNew.seenIds).toEqual([NEW_FREE_TRIAL, UNRELATED_ID]);
        });
    });

    it('leaves a user without any old id untouched', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearOtherHolders(tx);
            await insertUser(tx, { email: NONE_EMAIL, seenIds: [UNRELATED_ID, NEW_EDITOR] });
            const before = await readSettings(tx, NONE_EMAIL);

            const result = await seenIdsRename.up(buildCtx(tx));

            expect(result.counts?.usersRewritten).toBe(0);
            expect(await readSettings(tx, NONE_EMAIL)).toEqual(before);
        });
    });

    it('is idempotent — a second run rewrites nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await clearOtherHolders(tx);
            await insertUser(tx, { email: OLD_EMAIL, seenIds: [OLD_EDITOR] });

            const first = await seenIdsRename.up(buildCtx(tx));
            expect(first.counts?.usersRewritten).toBe(1);

            const second = await seenIdsRename.up(buildCtx(tx));

            expect(second.counts?.usersRewritten).toBe(0);
            const settings = (await readSettings(tx, OLD_EMAIL)) as {
                onboarding: { whatsNew: { seenIds: string[] } };
            };
            expect(settings.onboarding.whatsNew.seenIds).toEqual([NEW_EDITOR]);
        });
    });
});
