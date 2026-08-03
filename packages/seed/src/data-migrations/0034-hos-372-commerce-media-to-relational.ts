/**
 * @fileoverview
 * Data migration: 0034-hos-372-commerce-media-to-relational
 *
 * Backfills every seeded gastronomy and experience listing's photos from the
 * `media` JSONB column into the relational `gastronomy_media` /
 * `experience_media` tables (HOS-372).
 *
 * ## Why this migration exists
 *
 * The commerce seeders used to write photos into the listing row's `media`
 * JSONB blob. Every read path now composes photos from the relational tables
 * instead, and the `media` column is being dropped, so an already-seeded
 * environment would silently serve commerce listings with NO photos: the blob
 * still holds them, but nothing reads it any more.
 *
 * The baseline seeders were updated in the same change to write the relational
 * rows directly, which fixes a FRESH `db:fresh` / `db:fresh-dev`. This
 * migration is the other half of the dual-write rule — without it, staging and
 * production keep their photos in a column no reader consults, and then lose
 * them outright when that column is dropped.
 *
 * ## What it does
 *
 * For every listing whose `media` blob carries a `featuredImage` or a non-empty
 * `gallery`, and which has NO media rows yet, it inserts one row per photo:
 * the featured image at `sortOrder` 0 with `isFeatured = true`, then the
 * gallery in order. Row shape and ordering come from the same `buildMediaRows`
 * helper the seeders use, so a backfill and a fresh seed cannot drift apart.
 *
 * Videos are deliberately NOT touched: they are external YouTube/Vimeo URLs
 * that live in each entity's own `videos` column, never in the media tables.
 *
 * ## Idempotency
 *
 * A listing that already has at least one media row is skipped entirely, so
 * re-running never duplicates a gallery. It only ever INSERTs — nothing is
 * deleted, and the `media` blob is left untouched for the schema migration that
 * drops the column to remove.
 *
 * ## Why the source columns are read with raw SQL
 *
 * `gastronomies.media` and `experiences.media` are dropped from the Drizzle
 * schema by the very cutover this migration precedes. Referencing them through
 * the typed table objects would stop this file compiling the moment the columns
 * are removed, even though the migration itself has long since run and been
 * recorded in the ledger. Raw SQL keeps it readable and compiling forever.
 *
 * A `to_regclass` / `information_schema` guard makes the read safe on a database
 * where the columns are already gone: there is nothing left to backfill there,
 * so the migration reports zero and exits.
 */
import { experienceMedia, gastronomyMedia, inArray, sql } from '@repo/db';
import {
    buildExperienceMediaRows,
    buildGastronomyMediaRows
} from '../utils/commerce-media-builder.js';
import type { FixtureMediaBlock } from '../utils/media-rows-builder.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0034-hos-372-commerce-media-to-relational',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** A listing whose JSONB blob actually carries photos worth backfilling. */
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
 * Reads `(id, media)` from a listing table with raw SQL, tolerating a database
 * where the `media` column has already been dropped.
 *
 * Returns an empty list in that case: the cutover is complete there, so there is
 * nothing left to move.
 *
 * @param db - Transaction-scoped Drizzle client.
 * @param table - Listing table name (`gastronomies` or `experiences`).
 * @returns Listings whose blob still carries photos.
 */
async function readPhotoCandidates(
    db: SeedMigrationCtx['db'],
    table: 'gastronomies' | 'experiences'
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

    // ── Gastronomy ──────────────────────────────────────────────────────────
    const gastronomyCandidates = await readPhotoCandidates(db, 'gastronomies');

    // One query for the whole set rather than one per listing: any id that
    // already owns a media row has been migrated and must be left alone.
    const gastronomyMigrated = new Set<string>(
        gastronomyCandidates.length === 0
            ? []
            : (
                  await db
                      .select({ gastronomyId: gastronomyMedia.gastronomyId })
                      .from(gastronomyMedia)
                      .where(
                          inArray(
                              gastronomyMedia.gastronomyId,
                              gastronomyCandidates.map((row) => row.id)
                          )
                      )
              ).map((row) => row.gastronomyId)
    );

    let gastronomyListings = 0;
    let gastronomyPhotos = 0;
    for (const listing of gastronomyCandidates) {
        if (gastronomyMigrated.has(listing.id)) continue;
        const rows = buildGastronomyMediaRows({
            gastronomyId: listing.id,
            media: listing.media
        }) as (typeof gastronomyMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(gastronomyMedia).values(rows);
        gastronomyListings += 1;
        gastronomyPhotos += rows.length;
    }

    // ── Experience ──────────────────────────────────────────────────────────
    const experienceCandidates = await readPhotoCandidates(db, 'experiences');

    const experienceMigrated = new Set<string>(
        experienceCandidates.length === 0
            ? []
            : (
                  await db
                      .select({ experienceId: experienceMedia.experienceId })
                      .from(experienceMedia)
                      .where(
                          inArray(
                              experienceMedia.experienceId,
                              experienceCandidates.map((row) => row.id)
                          )
                      )
              ).map((row) => row.experienceId)
    );

    let experienceListings = 0;
    let experiencePhotos = 0;
    for (const listing of experienceCandidates) {
        if (experienceMigrated.has(listing.id)) continue;
        const rows = buildExperienceMediaRows({
            experienceId: listing.id,
            media: listing.media
        }) as (typeof experienceMedia.$inferInsert)[];
        if (rows.length === 0) continue;
        await db.insert(experienceMedia).values(rows);
        experienceListings += 1;
        experiencePhotos += rows.length;
    }

    return {
        summary:
            `Backfilled ${gastronomyPhotos} photo(s) across ${gastronomyListings} gastronomy listing(s) ` +
            `and ${experiencePhotos} photo(s) across ${experienceListings} experience listing(s)`
    };
}
