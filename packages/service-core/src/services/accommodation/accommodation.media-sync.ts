/**
 * accommodation.media-sync.ts
 *
 * Transactional helper that mirrors the `accommodations.media` JSONB column
 * into the relational `accommodation_media` table as part of an accommodation
 * create or update operation (SPEC-204, T-007).
 *
 * Phase 1 (P1) contract:
 *  - WRITES go to BOTH the JSONB column and `accommodation_media` (this module).
 *  - READS still come from the JSONB column only (read switch happens in T-012/T-013).
 *  - The relational table is a shadow copy in P1; nothing reads it yet.
 *
 * Reconciliation strategy (mirrors junction-sync):
 *  - DELETE all existing rows for the accommodation (hard-delete).
 *  - INSERT the new set derived from the media payload.
 *  - This replace-all approach is consistent with how junction-sync handles
 *    ordered / full-replacement writes (e.g. re-order wipes + re-inserts).
 *
 * Ordering guarantee (matches the T-006 backfill mapping):
 *  - featuredImage → sort_order 0, is_featured=true, state='visible'.
 *  - gallery[n]    → sort_order = (featured ? n : n-1), is_featured=false, state='visible'.
 *    (WITH ORDINALITY gives 1-based ordinals; if no featured image, subtract 1 to start at 0.)
 *  - archivedGallery[n] → sort_order = n-1 (0-based, own sequence), state='archived',
 *    archived_at = NOW() (back-fill timestamp; see P1 note below).
 *
 * P1 note on archivedAt reset:
 *  In P1 every media update replaces all rows, so `archivedAt` is reset to NOW()
 *  on each save. This is acceptable because SPEC-167 restore logic still reads from
 *  the JSONB column (T-008). Once reads switch to the relational table (T-012/T-013)
 *  a more granular diff-and-preserve strategy for `archivedAt` will be needed.
 *
 * @module accommodation.media-sync
 */

import type { AccommodationMediaModel } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import type { InsertAccommodationMedia } from '@repo/db';
import type { Image, Media } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Inputs required by {@link syncAccommodationMedia}.
 *
 * Note: `media` is the VALUE being written to `accommodations.media` JSONB —
 * the caller must pass the normalized media object after any schema processing,
 * not the raw request payload. Pass `undefined` to skip the sync entirely
 * (no-op contract: non-media updates leave the shadow table untouched).
 */
export interface SyncAccommodationMediaInput {
    /** UUID of the accommodation whose media is being written. */
    readonly accommodationId: string;
    /**
     * The media value being persisted.
     * - `undefined` → **no-op**: leave existing rows untouched.
     * - Defined (even `{}` with no gallery)  → full replace.
     */
    readonly media: Media | undefined | null;
    /** Media model injected by the service (injectable for testing). */
    readonly mediaModel: AccommodationMediaModel;
    /** Active Drizzle transaction client (must be the same tx as the accommodation write). */
    readonly tx: DrizzleClient;
}

// ---------------------------------------------------------------------------
// Private mapping helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the standard ImageSchema fields from a photo JSON object and maps
 * them to `InsertAccommodationMedia` column names.
 *
 * Optional fields (caption, description, alt, publicId, attribution) are set to
 * `undefined` when absent from the photo object so the DB column receives NULL.
 */
function mapImageFields(
    photo: Image
): Pick<
    InsertAccommodationMedia,
    'url' | 'caption' | 'description' | 'alt' | 'publicId' | 'attribution' | 'moderationState'
> {
    return {
        url: photo.url,
        caption: photo.caption ?? undefined,
        description: photo.description ?? undefined,
        alt: photo.alt ?? undefined,
        publicId: photo.publicId ?? undefined,
        // attribution is ImageAttribution | undefined in Zod; cast to the JSONB column type.
        attribution: photo.attribution ?? undefined,
        // Default to 'PENDING' when absent (mirrors backfill logic).
        moderationState: (photo.moderationState ??
            'PENDING') as InsertAccommodationMedia['moderationState']
    };
}

// ---------------------------------------------------------------------------
// Public sync function
// ---------------------------------------------------------------------------

/**
 * Reconciles `accommodation_media` rows from the accommodation's `media` JSONB
 * object inside an existing database transaction.
 *
 * Contract:
 *  - `media === undefined` → **no-op** (leave existing rows untouched).
 *  - `media === null` or `media === {}` with no photos → delete all existing rows.
 *  - `media` with photos → delete-all then re-insert the full set.
 *
 * All mutations happen on the caller-supplied `tx` so they run inside the same
 * transaction as the accommodation write. A failure rolls back both writes atomically.
 *
 * @param input - {@link SyncAccommodationMediaInput}
 * @throws Re-throws any DB error from model operations (rolls back the transaction).
 */
export async function syncAccommodationMedia({
    accommodationId,
    media,
    mediaModel,
    tx
}: SyncAccommodationMediaInput): Promise<void> {
    // undefined → leave existing rows untouched (no-op contract).
    if (media === undefined) return;

    // Step 1: delete all existing rows for this accommodation (hard-delete).
    // We use hardDelete instead of softDelete because:
    //  a) The shadow table has no consumer yet (P1); stale rows are just waste.
    //  b) Consistency with junction-sync which also hard-deletes before re-insert.
    // Note: hardDelete removes ALL rows matching the filter, including any that
    // were previously soft-deleted (deleted_at IS NOT NULL). This is acceptable
    // in P1 — there is no audit requirement for the shadow table at this stage.
    await mediaModel.hardDelete({ accommodationId }, tx);

    // media === null means "clear all rows" — delete is done, nothing to insert.
    if (media === null) return;

    // Collect the new rows to insert.
    const rows: InsertAccommodationMedia[] = [];
    const now = new Date();

    const hasFeatured =
        media.featuredImage != null &&
        typeof media.featuredImage === 'object' &&
        Boolean(media.featuredImage.url);

    // ── Featured image (sort_order 0) ─────────────────────────────────────
    if (hasFeatured && media.featuredImage) {
        rows.push({
            accommodationId,
            ...mapImageFields(media.featuredImage),
            state: 'visible',
            isFeatured: true,
            sortOrder: 0,
            archivedAt: null,
            createdAt: now,
            updatedAt: now
        });
    }

    // ── Gallery photos ─────────────────────────────────────────────────────
    if (Array.isArray(media.gallery)) {
        media.gallery.forEach((photo, index) => {
            if (!photo?.url) return; // skip malformed entries
            // 0-based ordinal; if a featured image exists it holds sort_order 0,
            // so gallery starts at 1; otherwise gallery starts at 0.
            const sortOrder = hasFeatured ? index + 1 : index;
            rows.push({
                accommodationId,
                ...mapImageFields(photo),
                state: 'visible',
                isFeatured: false,
                sortOrder,
                archivedAt: null,
                createdAt: now,
                updatedAt: now
            });
        });
    }

    // ── Archived gallery (SPEC-167) ────────────────────────────────────────
    if (Array.isArray(media.archivedGallery)) {
        media.archivedGallery.forEach((photo, index) => {
            if (!photo?.url) return; // skip malformed entries
            rows.push({
                accommodationId,
                ...mapImageFields(photo),
                state: 'archived',
                isFeatured: false,
                sortOrder: index, // 0-based, independent sequence
                archivedAt: now, // P1: reset to now() on every save (acceptable, see module JSDoc)
                createdAt: now,
                updatedAt: now
            });
        });
    }

    // Nothing to insert (e.g. media was {} or had only videos).
    if (rows.length === 0) return;

    // Step 2: bulk insert all new rows.
    // BaseModel.create() takes one row at a time; we iterate rather than using a
    // single batch INSERT because accommodation photos are typically ≤25 per write
    // and the overhead is negligible. A future optimisation can consolidate into
    // a single INSERT ... VALUES (...),(...) if profiling shows it matters.
    for (const row of rows) {
        await mediaModel.create(row as Parameters<typeof mediaModel.create>[0], tx);
    }
}
