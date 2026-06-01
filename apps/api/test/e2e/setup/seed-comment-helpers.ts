/**
 * @file seed-comment-helpers.ts
 *
 * E2E seed factories for the comment system (SPEC-165 T-012).
 *
 * Provides minimal-viable insert factories for posts, events, and
 * entity-comments. All writes go through getDb() (the shared connection
 * singleton) so they are immediately visible to the Hono app's service layer
 * when the test makes HTTP requests. Data is cleaned up via testDb.clean()
 * in afterEach.
 */

import { events, entityComments, eq, getDb, posts } from '@repo/db';
import type { EntityComment, Event, Post } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Post factory
// ---------------------------------------------------------------------------

/**
 * Options for {@link seedPost}.
 */
export interface SeedPostOptions {
    /** Owning author. Must already exist in the DB. */
    readonly authorId: string;
    readonly slug?: string;
    /** Defaults to 'PUBLIC' (required for public-comment queries). */
    readonly visibility?: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
    /** Defaults to now (required for the post to be considered "published"). */
    readonly publishedAt?: Date | null;
    /** Initial comments counter value. Defaults to 0. */
    readonly comments?: number;
}

/**
 * Result of {@link seedPost}.
 */
export interface SeedPostResult {
    readonly post: Post;
    readonly postId: string;
}

/**
 * Insert a minimal published post row directly (bypasses service layer).
 *
 * @param options - Seed options including required `authorId`.
 * @returns The inserted post row and its id.
 */
export async function seedPost(options: SeedPostOptions): Promise<SeedPostResult> {
    const db = getDb();
    const timestamp = Date.now();
    const slug = options.slug ?? `e2e-post-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

    // publishedAt: if explicitly null, insert null; otherwise default to now
    const publishedAt = options.publishedAt === null ? null : (options.publishedAt ?? new Date());

    const inserted = await db
        .insert(posts)
        .values({
            slug,
            category: 'GENERAL',
            title: `E2E Test Post ${timestamp}`,
            summary: 'Summary for E2E test post.',
            content: 'Content for E2E test post. Long enough to be valid.',
            authorId: options.authorId,
            visibility: options.visibility ?? 'PUBLIC',
            publishedAt,
            moderationState: 'APPROVED',
            comments: options.comments ?? 0
        })
        .returning();

    const row = inserted[0];
    if (!row) {
        throw new Error('seedPost: insert returned no row');
    }

    return { post: row as unknown as Post, postId: row.id };
}

// ---------------------------------------------------------------------------
// Event factory
// ---------------------------------------------------------------------------

/**
 * Options for {@link seedEvent}.
 */
export interface SeedEventOptions {
    /** Owning author. Must already exist in the DB. */
    readonly authorId: string;
    readonly slug?: string;
    /** Defaults to 'PUBLIC'. */
    readonly visibility?: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
}

/**
 * Result of {@link seedEvent}.
 */
export interface SeedEventResult {
    readonly event: Event;
    readonly eventId: string;
}

/**
 * Insert a minimal published event row directly (bypasses service layer).
 *
 * @param options - Seed options including required `authorId`.
 * @returns The inserted event row and its id.
 */
export async function seedEvent(options: SeedEventOptions): Promise<SeedEventResult> {
    const db = getDb();
    const timestamp = Date.now();
    const slug = options.slug ?? `e2e-event-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

    const inserted = await db
        .insert(events)
        .values({
            slug,
            name: `E2E Test Event ${timestamp}`,
            summary: 'Summary for E2E test event.',
            category: 'CULTURE',
            date: {
                start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
            },
            authorId: options.authorId,
            visibility: options.visibility ?? 'PUBLIC',
            moderationState: 'APPROVED'
        })
        .returning();

    const row = inserted[0];
    if (!row) {
        throw new Error('seedEvent: insert returned no row');
    }

    return { event: row as unknown as Event, eventId: row.id };
}

// ---------------------------------------------------------------------------
// Comment factory
// ---------------------------------------------------------------------------

/**
 * Options for {@link seedComment}.
 */
export interface SeedCommentOptions {
    /** The entity type ('POST' or 'EVENT'). */
    readonly entityType: 'POST' | 'EVENT';
    /** The entity the comment belongs to. */
    readonly entityId: string;
    /** Author user id. Must already exist in the DB. */
    readonly authorId: string;
    readonly content?: string;
    /** Defaults to 'APPROVED'. */
    readonly moderationState?: 'APPROVED' | 'REJECTED' | 'PENDING';
    /** When set, marks the comment as soft-deleted at this timestamp. */
    readonly deletedAt?: Date;
}

/**
 * Result of {@link seedComment}.
 */
export interface SeedCommentResult {
    readonly comment: EntityComment;
    readonly commentId: string;
}

/**
 * Insert an entity comment row directly into the database.
 *
 * Does NOT go through the service layer (no counter sync). Use this to set
 * up pre-existing fixture state. To test counter sync, use the HTTP API
 * methods so the service runs.
 *
 * @param options - Seed options.
 * @returns The inserted comment row and its id.
 */
export async function seedComment(options: SeedCommentOptions): Promise<SeedCommentResult> {
    const db = getDb();
    const timestamp = Date.now();

    const insertValues = {
        entityType: options.entityType,
        entityId: options.entityId,
        authorId: options.authorId,
        content: options.content ?? `E2E test comment ${timestamp}`,
        moderationState: options.moderationState ?? 'APPROVED',
        createdById: options.authorId,
        updatedById: options.authorId,
        ...(options.deletedAt ? { deletedAt: options.deletedAt } : {})
    };

    const inserted = await db
        .insert(entityComments)
        .values(insertValues as typeof entityComments.$inferInsert)
        .returning();

    const row = inserted[0];
    if (!row) {
        throw new Error('seedComment: insert returned no row');
    }

    return {
        comment: row as unknown as EntityComment,
        commentId: row.id
    };
}

// ---------------------------------------------------------------------------
// Counter read helper
// ---------------------------------------------------------------------------

/**
 * Re-read the `posts.comments` counter for a post from the live database.
 *
 * Use this after any HTTP mutation to verify the counter was kept in sync
 * by the service. Reads via getDb() — the same connection the service uses.
 *
 * @param postId - The post id.
 * @returns The current `comments` counter value.
 */
export async function readPostCommentsCounter(postId: string): Promise<number> {
    const db = getDb();
    const result = await db
        .select({ comments: posts.comments })
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);

    const row = result[0];
    if (!row) {
        throw new Error(`readPostCommentsCounter: post ${postId} not found`);
    }

    return row.comments;
}
