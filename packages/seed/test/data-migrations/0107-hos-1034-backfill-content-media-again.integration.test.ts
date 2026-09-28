/**
 * @fileoverview
 * Integration tests for `0107-hos-1034-backfill-content-media-again`.
 *
 * Runs against the REAL integration database with the rollback-isolation idiom
 * of `reattribute-imported-events.integration.test.ts`: every test opens a
 * transaction, runs setup + `up()` + assertions inside it, then throws a
 * sentinel so nothing survives.
 *
 * A real database rather than a stubbed `ctx.db` on purpose: this migration's
 * idempotency lives in its `NOT EXISTS` clause. What has to be proven is that
 * a post/event with ANY media row (even a soft-deleted one) is never selected,
 * and that a second run writes nothing — a stub would only prove a query was
 * issued.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import {
    asc,
    eq,
    eventMedia,
    events,
    getDb,
    initializeDb,
    postMedia,
    posts,
    resetDb,
    users
} from '@repo/db';
import {
    EventCategoryEnum,
    EventDatePrecisionEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    RoleEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0107-hos-1034-backfill-content-media-again.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos1034-';
const AUTHOR_EMAIL = 'zzz-test-hos1034-author@example.test';

const PHOTO_BLOCK = {
    featuredImage: { url: 'https://cdn.example.test/featured.jpg' },
    gallery: [
        { url: 'https://cdn.example.test/g1.jpg', caption: 'One' },
        { url: 'https://cdn.example.test/g2.jpg', caption: 'Two' }
    ]
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
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

/** Inserts the author every fixture row points at. */
async function insertAuthor(tx: DrizzleClient): Promise<string> {
    await tx.delete(users).where(eq(users.email, AUTHOR_EMAIL));
    const [row] = await tx
        .insert(users)
        .values({ email: AUTHOR_EMAIL })
        .returning({ id: users.id });
    if (!row) throw new Error('Failed to insert test author');
    return row.id;
}

/** Inserts one post carrying `media` in its JSONB column. */
async function insertPost(
    tx: DrizzleClient,
    input: { readonly key: string; readonly authorId: string; readonly media: unknown }
): Promise<string> {
    const [row] = await tx
        .insert(posts)
        .values({
            slug: `${PREFIX}${input.key}`,
            category: PostCategoryEnum.GENERAL,
            title: `Test post ${input.key}`,
            summary: 'Summary',
            content: 'Content',
            authorId: input.authorId,
            media: input.media as typeof posts.$inferInsert.media
        })
        .returning({ id: posts.id });
    if (!row) throw new Error(`Failed to insert post ${input.key}`);
    return row.id;
}

/** Inserts one event carrying `media` in its JSONB column. */
async function insertEvent(
    tx: DrizzleClient,
    input: { readonly key: string; readonly authorId: string; readonly media: unknown }
): Promise<string> {
    const [row] = await tx
        .insert(events)
        .values({
            slug: `${PREFIX}${input.key}`,
            name: `Test event ${input.key}`,
            summary: 'Summary',
            category: EventCategoryEnum.OTHER,
            date: {
                start: new Date('2026-10-01T18:00:00.000Z'),
                isAllDay: false,
                precision: EventDatePrecisionEnum.EXACT
            },
            authorId: input.authorId,
            media: input.media as typeof events.$inferInsert.media
        })
        .returning({ id: events.id });
    if (!row) throw new Error(`Failed to insert event ${input.key}`);
    return row.id;
}

/** Reads a post's media rows in display order. */
async function readPostMedia(tx: DrizzleClient, postId: string) {
    return tx
        .select({
            url: postMedia.url,
            sortOrder: postMedia.sortOrder,
            isFeatured: postMedia.isFeatured
        })
        .from(postMedia)
        .where(eq(postMedia.postId, postId))
        .orderBy(asc(postMedia.sortOrder));
}

/** Reads an event's media rows in display order. */
async function readEventMedia(tx: DrizzleClient, eventId: string) {
    return tx
        .select({ url: eventMedia.url, sortOrder: eventMedia.sortOrder })
        .from(eventMedia)
        .where(eq(eventMedia.eventId, eventId))
        .orderBy(asc(eventMedia.sortOrder));
}

describe('HOS-1034: 0107-hos-1034-backfill-content-media-again (integration)', () => {
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

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('should declare a non-destructive migration that requires both media columns', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.requiresColumns).toEqual([
            { table: 'posts', column: 'media' },
            { table: 'events', column: 'media' }
        ]);
    });

    it('should backfill posts and events whose photos live only in the JSONB', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const authorId = await insertAuthor(tx);
            const postId = await insertPost(tx, { key: 'post', authorId, media: PHOTO_BLOCK });
            const eventId = await insertEvent(tx, {
                key: 'event',
                authorId,
                media: { gallery: PHOTO_BLOCK.gallery }
            });

            // Act
            await migration.up(buildCtx(tx, authorId));

            // Assert: featured first at sortOrder 0, then the gallery in order.
            expect(await readPostMedia(tx, postId)).toEqual([
                { url: 'https://cdn.example.test/featured.jpg', sortOrder: 0, isFeatured: true },
                { url: 'https://cdn.example.test/g1.jpg', sortOrder: 1, isFeatured: false },
                { url: 'https://cdn.example.test/g2.jpg', sortOrder: 2, isFeatured: false }
            ]);
            expect((await readEventMedia(tx, eventId)).map((row) => row.url)).toEqual([
                'https://cdn.example.test/g1.jpg',
                'https://cdn.example.test/g2.jpg'
            ]);
        });
    });

    it('should leave alone a post that already owns a media row, even a soft-deleted one', async () => {
        await withRollback(async (tx) => {
            // Arrange: an editor removed the only photo — resurrecting the JSONB
            // gallery would undo that.
            const authorId = await insertAuthor(tx);
            const postId = await insertPost(tx, { key: 'edited', authorId, media: PHOTO_BLOCK });
            await tx.insert(postMedia).values({
                postId,
                url: 'https://cdn.example.test/kept.jpg',
                sortOrder: 0,
                isFeatured: true,
                moderationState: ModerationStatusEnum.APPROVED,
                deletedAt: new Date()
            });

            // Act
            await migration.up(buildCtx(tx, authorId));

            // Assert
            expect((await readPostMedia(tx, postId)).map((row) => row.url)).toEqual([
                'https://cdn.example.test/kept.jpg'
            ]);
        });
    });

    it('should ignore blobs that carry no photos', async () => {
        await withRollback(async (tx) => {
            const authorId = await insertAuthor(tx);
            const videosOnly = await insertPost(tx, {
                key: 'videos',
                authorId,
                media: { videos: [{ url: 'https://youtube.com/watch?v=x' }] }
            });
            const emptyGallery = await insertEvent(tx, {
                key: 'empty',
                authorId,
                media: { gallery: [] }
            });

            await migration.up(buildCtx(tx, authorId));

            expect(await readPostMedia(tx, videosOnly)).toHaveLength(0);
            expect(await readEventMedia(tx, emptyGallery)).toHaveLength(0);
        });
    });

    it('should write nothing on a second run', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const authorId = await insertAuthor(tx);
            const postId = await insertPost(tx, { key: 'rerun', authorId, media: PHOTO_BLOCK });
            await migration.up(buildCtx(tx, authorId));

            // Act
            const second = await migration.up(buildCtx(tx, authorId));

            // Assert: the whole database is at its target state after run one.
            expect(second.summary).toBe(
                'Backfilled 0 photo(s) across 0 post(s) and 0 photo(s) across 0 event(s)'
            );
            expect(await readPostMedia(tx, postId)).toHaveLength(3);
        });
    });
});
