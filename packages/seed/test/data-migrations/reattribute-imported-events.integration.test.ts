/**
 * @fileoverview
 * Integration tests for `0036-reattribute-imported-events.ts` (HOS-375 T-007).
 *
 * Runs against the REAL integration database, using the rollback-isolation
 * idiom established by
 * `test/data-migrations/raise-commerce-listing-price-to-15000.integration.test.ts`:
 * every test opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside it, then unconditionally throws a sentinel
 * `RollbackSignal` so nothing this suite writes survives it.
 *
 * A real database rather than a stubbed `ctx.db` on purpose: this migration IS
 * its `WHERE` clause. What has to be proven is that
 * `author_id = <source> AND created_by_id IS NULL` selects the imported batch
 * and nothing a human created — a stub would only assert that a fluent chain
 * was written.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { eq, events, getDb, inArray, initializeDb, resetDb, users } from '@repo/db';
import { EventCategoryEnum, EventDatePrecisionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as reattributeImportedEvents from '../../src/data-migrations/0036-reattribute-imported-events.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';
const SUPER_ADMIN_EMAIL = 'superadmin@hospeda.com';
/** A real person who authored events through the UI. */
const HUMAN_EMAIL = 'zzz-test-hos375-human@example.test';
/**
 * Stands in for the real person promoted to `SUPER_ADMIN` on a production
 * bootstrap that never seeds `superadmin@hospeda.com`.
 */
const PROMOTED_ADMIN_EMAIL = 'zzz-test-hos375-promoted@example.test';

const EVENT_SLUG_PREFIX = 'zzz-test-hos375-';

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

/**
 * Builds the migration ctx against a transaction-scoped client. `actorId`
 * matters: it is the fallback source author when `superadmin@hospeda.com` is
 * absent.
 */
function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = {
        id: actorId,
        roles: [RoleEnum.SUPER_ADMIN],
        permissions: []
    };

    return {
        db: tx,
        actor,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

/** Inserts one user and returns its generated id. */
async function insertUser(tx: DrizzleClient, email: string): Promise<string> {
    const [row] = await tx.insert(users).values({ email }).returning({ id: users.id });

    if (!row) {
        throw new Error(`Failed to insert test user ${email}`);
    }
    return row.id;
}

/**
 * Inserts one event. `createdById === null` reproduces the bulk-import
 * signature `0027`/`0028` leave behind; a non-null value reproduces a
 * service-layer (human) write.
 */
async function insertEvent(
    tx: DrizzleClient,
    slug: string,
    authorId: string,
    createdById: string | null
): Promise<void> {
    await tx.insert(events).values({
        slug: `${EVENT_SLUG_PREFIX}${slug}`,
        name: `Test event ${slug}`,
        summary: `Summary for ${slug}`,
        category: EventCategoryEnum.OTHER,
        date: {
            start: new Date('2026-09-01T18:00:00.000Z'),
            isAllDay: false,
            precision: EventDatePrecisionEnum.EXACT
        },
        authorId,
        createdById
    });
}

/** Reads the author id of one event by its (prefixed) slug. */
async function readAuthorId(tx: DrizzleClient, slug: string): Promise<string | undefined> {
    const rows = await tx
        .select({ authorId: events.authorId })
        .from(events)
        .where(eq(events.slug, `${EVENT_SLUG_PREFIX}${slug}`))
        .limit(1);

    return rows[0]?.authorId;
}

/**
 * Removes rows this suite may collide with: its own events, and any user whose
 * email it reuses. Events go first — `events.author_id` is `ON DELETE RESTRICT`.
 */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    const emails = [EDITORIAL_EMAIL, SUPER_ADMIN_EMAIL, HUMAN_EMAIL, PROMOTED_ADMIN_EMAIL];
    const owners = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.email, emails));

    if (owners.length > 0) {
        await tx.delete(events).where(
            inArray(
                events.authorId,
                owners.map((o) => o.id)
            )
        );
    }
    await tx.delete(users).where(inArray(users.email, emails));
}

describe('HOS-375 T-007: 0036-reattribute-imported-events (integration)', () => {
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

    it('moves the imported batch and leaves human-created events alone', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const editorialId = await insertUser(tx, EDITORIAL_EMAIL);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            const humanId = await insertUser(tx, HUMAN_EMAIL);

            // Two imports by the super admin...
            await insertEvent(tx, 'imported-1', superAdminId, null);
            await insertEvent(tx, 'imported-2', superAdminId, null);
            // ...one event the super admin created through the UI...
            await insertEvent(tx, 'super-admin-authored', superAdminId, superAdminId);
            // ...and one a real person authored.
            await insertEvent(tx, 'human-authored', humanId, humanId);

            const result = await reattributeImportedEvents.up(buildCtx(tx, superAdminId));

            expect(result.counts?.eventsMatchedBefore).toBe(2);
            expect(result.counts?.eventsReattributed).toBe(2);
            expect(result.counts?.eventsMatchedAfter).toBe(0);

            expect(await readAuthorId(tx, 'imported-1')).toBe(editorialId);
            expect(await readAuthorId(tx, 'imported-2')).toBe(editorialId);

            // The `created_by_id IS NULL` clause is the whole guarantee: an event
            // the SAME author created through the UI keeps its author.
            expect(await readAuthorId(tx, 'super-admin-authored')).toBe(superAdminId);
            expect(await readAuthorId(tx, 'human-authored')).toBe(humanId);
        });
    });

    it('is idempotent — a second run matches and moves nothing', async () => {
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const editorialId = await insertUser(tx, EDITORIAL_EMAIL);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            await insertEvent(tx, 'imported-1', superAdminId, null);

            const first = await reattributeImportedEvents.up(buildCtx(tx, superAdminId));
            expect(first.counts?.eventsReattributed).toBe(1);

            const second = await reattributeImportedEvents.up(buildCtx(tx, superAdminId));

            expect(second.counts?.eventsMatchedBefore).toBe(0);
            expect(second.counts?.eventsReattributed).toBe(0);
            expect(await readAuthorId(tx, 'imported-1')).toBe(editorialId);
        });
    });

    it('falls back to the acting actor when superadmin@hospeda.com does not exist', async () => {
        // The documented production bootstrap (`--required --exclude=users`,
        // promote a real person, THEN run the ledger) never creates that
        // account, so `0027`/`0028` attribute every import to the promoted
        // human. An email-only lookup would skip here and publish 44 imported
        // events under a real person's author page.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const editorialId = await insertUser(tx, EDITORIAL_EMAIL);
            const promotedId = await insertUser(tx, PROMOTED_ADMIN_EMAIL);
            await insertEvent(tx, 'imported-1', promotedId, null);
            await insertEvent(tx, 'promoted-authored', promotedId, promotedId);

            const result = await reattributeImportedEvents.up(buildCtx(tx, promotedId));

            expect(result.counts?.eventsReattributed).toBe(1);
            expect(await readAuthorId(tx, 'imported-1')).toBe(editorialId);
            expect(await readAuthorId(tx, 'promoted-authored')).toBe(promotedId);
        });
    });

    it('prefers the seeded super-admin over the acting actor when both exist', async () => {
        // The fallback must never shadow the primary lookup: in a live
        // environment the actor running the ledger today may be a different
        // super admin than the one the import ran as.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const editorialId = await insertUser(tx, EDITORIAL_EMAIL);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            const promotedId = await insertUser(tx, PROMOTED_ADMIN_EMAIL);

            await insertEvent(tx, 'imported-by-fixture', superAdminId, null);
            await insertEvent(tx, 'imported-by-promoted', promotedId, null);

            const result = await reattributeImportedEvents.up(buildCtx(tx, promotedId));

            expect(result.counts?.eventsReattributed).toBe(1);
            expect(await readAuthorId(tx, 'imported-by-fixture')).toBe(editorialId);
            expect(await readAuthorId(tx, 'imported-by-promoted')).toBe(promotedId);
        });
    });

    it('THROWS when it matches zero events and nothing was ever re-attributed', async () => {
        // The silent-failure case. `SUPER_ADMIN_EMAIL` is hardcoded and the
        // `ctx.actor.id` fallback only fires when that account is ABSENT — so on
        // an environment where it EXISTS but is not the account `0027`/`0028`
        // ran as, the lookup succeeds, matches nothing, and the fallback never
        // engages. Reporting success there ledgers the migration forever with
        // the imported events still under a real person's byline (AC-14).
        await withRollback(async (tx) => {
            await clearTargets(tx);
            await insertUser(tx, EDITORIAL_EMAIL);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            const promotedId = await insertUser(tx, PROMOTED_ADMIN_EMAIL);

            // The import really ran as the promoted human; the fixture account
            // exists but authored nothing.
            await insertEvent(tx, 'imported-by-promoted', promotedId, null);

            await expect(reattributeImportedEvents.up(buildCtx(tx, superAdminId))).rejects.toThrow(
                /matched ZERO events/
            );

            // Nothing moved — the throw rolls the batch back, and the runner
            // records no ledger entry, so a corrected re-run is still possible.
            expect(await readAuthorId(tx, 'imported-by-promoted')).toBe(promotedId);
        });
    });

    it('does NOT throw on the idempotent re-run — the two zero-match cases are distinguished', async () => {
        // Non-vacuity for the case above: "matched zero" must not become a
        // blanket failure, or the second run of a correctly-applied migration
        // would abort the whole batch.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const editorialId = await insertUser(tx, EDITORIAL_EMAIL);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            await insertEvent(tx, 'imported-1', superAdminId, null);

            await reattributeImportedEvents.up(buildCtx(tx, superAdminId));
            const second = await reattributeImportedEvents.up(buildCtx(tx, superAdminId));

            expect(second.counts?.eventsReattributed).toBe(0);
            expect(second.summary).toMatch(/Already applied/);
            expect(await readAuthorId(tx, 'imported-1')).toBe(editorialId);
        });
    });

    it('is a silent no-op where the editorial account does not exist', async () => {
        // An environment that has not run `0025-seed-real-blog-posts` has no
        // editorial account. Throwing would abort the whole batch (HOS-25 G-5)
        // for a legitimate condition.
        await withRollback(async (tx) => {
            await clearTargets(tx);
            const superAdminId = await insertUser(tx, SUPER_ADMIN_EMAIL);
            await insertEvent(tx, 'imported-1', superAdminId, null);

            const result = await reattributeImportedEvents.up(buildCtx(tx, superAdminId));

            expect(result.counts?.eventsReattributed).toBe(0);
            expect(result.summary).toMatch(/absent from this environment/);
            expect(await readAuthorId(tx, 'imported-1')).toBe(superAdminId);
        });
    });
});
