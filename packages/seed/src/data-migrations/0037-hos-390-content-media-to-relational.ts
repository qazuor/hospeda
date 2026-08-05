/**
 * @fileoverview
 * Data migration: 0037-hos-390-content-media-to-relational
 *
 * Backfills every post's and event's photos from the `media` JSONB column into
 * the relational `post_media` / `event_media` tables (HOS-390).
 *
 * ## Why this migration exists
 *
 * `post_media` and `event_media` are the new source of truth for editorial
 * photos, mirroring what HOS-372 did for commerce listings. Reads switch to them
 * in the next step, so an already-seeded environment would serve every post and
 * event with NO photos unless the existing blobs are moved first: the JSONB
 * still holds them, but nothing would read it.
 *
 * ## What it does
 *
 * For every post/event whose `media` blob carries a `featuredImage` or a
 * non-empty `gallery`, and which has NO media rows yet, it inserts one row per
 * photo: the featured image at `sortOrder` 0 with `isFeatured = true`, then the
 * gallery in order. Row shape and ordering come from the same `buildMediaRows`
 * helper the seeders use, so a backfill and a fresh seed cannot drift apart.
 *
 * ## What it deliberately does NOT do
 *
 * - **Videos are not touched.** They are external YouTube/Vimeo URLs with no
 *   per-row state and no gallery ordering, so they stay in the `media` blob
 *   (SPEC-204 D1). Unlike the commerce cutover, the column is therefore NOT
 *   being dropped here — it keeps a job.
 * - **Nothing is deleted.** The photo entries stay in the blob. Stripping them
 *   (the accommodation cutover did that in a separate step) is only safe once
 *   every read path composes from the table, which is a later step.
 *
 * ## Idempotency
 *
 * A post/event that already has at least one media row is skipped entirely, so
 * re-running never duplicates a gallery. It only ever INSERTs.
 */
import { eventMedia, inArray, postMedia, sql } from '@repo/db';
import { buildEventMediaRows, buildPostMediaRows } from '../utils/content-media-builder.js';
import type { FixtureMediaBlock } from '../utils/media-rows-builder.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0037-hos-390-content-media-to-relational',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** A post or event whose JSONB blob actually carries photos worth backfilling. */
interface PhotoCandidate {
    readonly id: string;
    readonly media: FixtureMediaBlock;
}

/**
 * Narrows an unknown JSONB value to the photo-carrying block shape.
 *
 * Returns `null` for a blob that is absent, malformed, or videos-only — none of
 * which produce media rows.
 */
function toPhotoBlock(value: unknown): FixtureMediaBlock | null {
    if (!value || typeof value !== 'object') return null;
    const block = value as FixtureMediaBlock;
    const hasPhotos = Boolean(block.featuredImage) || (block.gallery?.length ?? 0) > 0;
    return hasPhotos ? block : null;
}

/**
 * Reads `(id, media)` from a content table with raw SQL, tolerating a database
 * where the `media` column does not exist.
 *
 * Raw SQL rather than the typed table object for the same reason as the commerce
 * backfill: this file must keep compiling long after it has run, whatever
 * happens to the column later.
 *
 * @param db - Transaction-scoped Drizzle client.
 * @param table - Content table name (`posts` or `events`).
 * @returns Rows whose blob still carries photos.
 */
async function readPhotoCandidates(
    db: SeedMigrationCtx['db'],
    table: 'posts' | 'events'
): Promise<PhotoCandidate[]> {
    const columnExists = await db.execute(
        sql`SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'media'`
    );
    if ((columnExists.rows?.length ?? 0) === 0) return [];

    // `sql.raw` is safe here: `table` is a closed union of two literals, never
    // caller-supplied text.
    const result = await db.execute(
        sql`SELECT id, media FROM ${sql.raw(table)} WHERE media IS NOT NULL`
    );

    return (result.rows as Array<{ id: string; media: unknown }>).flatMap((row) => {
        const media = toPhotoBlock(row.media);
        return media ? [{ id: row.id, media }] : [];
    });
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    // ── Posts ───────────────────────────────────────────────────────────────
    const postCandidates = await readPhotoCandidates(db, 'posts');

    // One query for the whole set rather than one per row: any id that already
    // owns a media row has been migrated and must be left alone.
    const postsMigrated = new Set<string>(
        postCandidates.length === 0
            ? []
            : (
                  await db
                      .select({ postId: postMedia.postId })
                      .from(postMedia)
                      .where(
                          inArray(
                              postMedia.postId,
                              postCandidates.map((row) => row.id)
                          )
                      )
              ).map((row) => row.postId)
    );

    let postsBackfilled = 0;
    let postPhotos = 0;
    for (const post of postCandidates) {
        if (postsMigrated.has(post.id)) continue;
        const rows = buildPostMediaRows({
            postId: post.id,
            media: post.media
        }) as (typeof postMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(postMedia).values(rows);
        postsBackfilled += 1;
        postPhotos += rows.length;
    }

    // ── Events ──────────────────────────────────────────────────────────────
    const eventCandidates = await readPhotoCandidates(db, 'events');

    const eventsMigrated = new Set<string>(
        eventCandidates.length === 0
            ? []
            : (
                  await db
                      .select({ eventId: eventMedia.eventId })
                      .from(eventMedia)
                      .where(
                          inArray(
                              eventMedia.eventId,
                              eventCandidates.map((row) => row.id)
                          )
                      )
              ).map((row) => row.eventId)
    );

    let eventsBackfilled = 0;
    let eventPhotos = 0;
    for (const event of eventCandidates) {
        if (eventsMigrated.has(event.id)) continue;
        const rows = buildEventMediaRows({
            eventId: event.id,
            media: event.media
        }) as (typeof eventMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(eventMedia).values(rows);
        eventsBackfilled += 1;
        eventPhotos += rows.length;
    }

    return {
        summary:
            `Backfilled ${postPhotos} photo(s) across ${postsBackfilled} post(s) ` +
            `and ${eventPhotos} photo(s) across ${eventsBackfilled} event(s)`
    };
}
