/**
 * @fileoverview
 * Data migration: 0107-hos-1034-backfill-content-media-again
 *
 * Re-runs the HOS-390 photo backfill (`0037-hos-390-content-media-to-relational`)
 * for every post and event whose photos live ONLY in the `media` JSONB column,
 * with no row in `post_media` / `event_media` (HOS-1034).
 *
 * ## Why this migration exists
 *
 * `0037` is correct, but it ran once and is ledgered: it cannot run again. On
 * staging it ran on 2026-08-05 over the data that existed then. On 2026-08-24
 * staging's example content was re-seeded, and the example post/event seeders
 * wrote the photos to the JSONB only — their `postProcess` hook read the new
 * row's id from the wrong place (`result.id` instead of the seed factory's
 * `result.data.id`), so it returned without writing a single media row. The
 * public read path composes photos from the relational tables, so those 18
 * posts and 23 events were served with no cover and no gallery.
 *
 * The seeder bug is fixed in the same change (the fresh-DB half of the
 * dual-write rule); this migration is the already-seeded half.
 *
 * ## What it does
 *
 * For every post/event with photos in its `media` blob and NO media row at all,
 * it inserts one row per photo — the featured image at `sortOrder` 0 with
 * `isFeatured = true`, then the gallery in order — through the same
 * `buildPostMediaRows` / `buildEventMediaRows` builders `0037` and the seeders
 * use, so the three writers cannot drift apart.
 *
 * ## What it deliberately does NOT do
 *
 * - **Videos are not touched**, and the photo entries stay in the blob. The
 *   `media` columns are not being dropped: they still hold videos (SPEC-204 D1).
 * - **No schema-existence probe** (HOS-513). Unlike `0037` it does not ask
 *   `information_schema` whether the column exists; the dependency is declared
 *   in `meta.requiresColumns` so the RUNNER refuses to start if it is missing,
 *   instead of this file silently reporting zero.
 * - **`0037` is not rewritten to share this code.** It is ledgered in every
 *   environment and frozen by `scripts/check-seed-migration-schema-probe.sh`;
 *   the row shape is already shared through the builders.
 *
 * ## Idempotency and the meaning of zero
 *
 * Candidates are selected by the TARGET state: `NOT EXISTS` any media row for
 * that post/event (soft-deleted rows included, so a gallery an editor emptied
 * is never resurrected). Re-running inserts nothing. A zero result is therefore
 * a fact about the data — every photo blob already has rows — which is the
 * expected outcome on production, where `0037` covered everything.
 */
import { eventMedia, postMedia, sql } from '@repo/db';
import { buildEventMediaRows, buildPostMediaRows } from '../utils/content-media-builder.js';
import type { FixtureMediaBlock } from '../utils/media-rows-builder.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0107-hos-1034-backfill-content-media-again',
    group: 'required',
    destructive: false,
    requiresColumns: [
        { table: 'posts', column: 'media' },
        { table: 'events', column: 'media' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** A post or event still missing its media rows, with its photo-carrying blob. */
interface PhotoCandidate {
    readonly id: string;
    readonly media: FixtureMediaBlock;
}

/** Outcome of backfilling one content table. */
interface BackfillCount {
    readonly owners: number;
    readonly photos: number;
}

/**
 * Narrows an unknown JSONB value to the photo-carrying block shape.
 *
 * @param value - The raw `media` JSONB value.
 * @returns The block, or `null` when it is absent, malformed or videos-only.
 */
function toPhotoBlock(value: unknown): FixtureMediaBlock | null {
    if (!value || typeof value !== 'object') return null;
    const block = value as FixtureMediaBlock;
    const hasPhotos = Boolean(block.featuredImage) || (block.gallery?.length ?? 0) > 0;
    return hasPhotos ? block : null;
}

/**
 * Reads the rows of a content table whose blob carries photos and which own NO
 * media row yet.
 *
 * Raw SQL rather than the typed table objects so this file keeps compiling
 * whatever later happens to the `media` columns. `sql.raw` is safe: both
 * identifiers come from a closed set of literals, never caller-supplied text.
 *
 * @param input.db - Transaction-scoped Drizzle client.
 * @param input.table - Content table (`posts` or `events`).
 * @param input.mediaTable - Its relational media table.
 * @param input.ownerColumn - The media table's foreign key to `table`.
 * @returns The rows still to backfill.
 */
async function readCandidates({
    db,
    table,
    mediaTable,
    ownerColumn
}: {
    readonly db: SeedMigrationCtx['db'];
    readonly table: 'posts' | 'events';
    readonly mediaTable: 'post_media' | 'event_media';
    readonly ownerColumn: 'post_id' | 'event_id';
}): Promise<PhotoCandidate[]> {
    const result = await db.execute(
        sql`SELECT c.id, c.media FROM ${sql.raw(table)} c
            WHERE c.media IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM ${sql.raw(mediaTable)} m
                  WHERE m.${sql.raw(ownerColumn)} = c.id
              )`
    );

    return (result.rows as Array<{ id: string; media: unknown }>).flatMap((row) => {
        const media = toPhotoBlock(row.media);
        return media ? [{ id: row.id, media }] : [];
    });
}

/**
 * Backfills `post_media` for every post still missing its rows.
 *
 * @param input.db - Transaction-scoped Drizzle client.
 * @returns How many posts and photos were written.
 */
async function backfillPosts({
    db
}: {
    readonly db: SeedMigrationCtx['db'];
}): Promise<BackfillCount> {
    const candidates = await readCandidates({
        db,
        table: 'posts',
        mediaTable: 'post_media',
        ownerColumn: 'post_id'
    });
    let owners = 0;
    let photos = 0;
    for (const post of candidates) {
        const rows = buildPostMediaRows({
            postId: post.id,
            media: post.media
        }) as (typeof postMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(postMedia).values(rows);
        owners += 1;
        photos += rows.length;
    }
    return { owners, photos };
}

/**
 * Backfills `event_media` for every event still missing its rows.
 *
 * @param input.db - Transaction-scoped Drizzle client.
 * @returns How many events and photos were written.
 */
async function backfillEvents({
    db
}: {
    readonly db: SeedMigrationCtx['db'];
}): Promise<BackfillCount> {
    const candidates = await readCandidates({
        db,
        table: 'events',
        mediaTable: 'event_media',
        ownerColumn: 'event_id'
    });
    let owners = 0;
    let photos = 0;
    for (const event of candidates) {
        const rows = buildEventMediaRows({
            eventId: event.id,
            media: event.media
        }) as (typeof eventMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(eventMedia).values(rows);
        owners += 1;
        photos += rows.length;
    }
    return { owners, photos };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const posts = await backfillPosts({ db: ctx.db });
    const events = await backfillEvents({ db: ctx.db });

    return {
        summary:
            `Backfilled ${posts.photos} photo(s) across ${posts.owners} post(s) ` +
            `and ${events.photos} photo(s) across ${events.owners} event(s)`
    };
}
