/**
 * Photo Archive/Restore Primitives (SPEC-167 T-009).
 *
 * Moves gallery items between `media.gallery` and `media.archivedGallery` in
 * the JSONB `media` column of `accommodations` reversibly. Sister module to
 * `plan-restriction.service.ts` (T-007 / T-008); extracted to keep files ≤500 lines.
 *
 * **Identity key — `url`:**
 * `ImageSchema` has no stable `id` field. The `url` string is the sole unique
 * identity key used by `keepIds` and all photo primitives. Callers must supply
 * fully-qualified image URLs.
 *
 * **Restore order — FIFO:**
 * Items are restored in the order they appear in `archivedGallery` (head of
 * the array = first archived = first restored). This is deterministic and
 * requires no additional timestamp metadata on each item.
 *
 * **Concurrency safety (M-1 fix):**
 * The read-modify-write runs inside `withTransaction` AND acquires a
 * pessimistic row lock via `SELECT ... FOR UPDATE` before computing the new
 * media state. This prevents lost-update races against concurrent media writers
 * (e.g. host edits) that run under PostgreSQL's default READ COMMITTED
 * isolation. `withTransaction` reuses an outer transaction when the caller
 * passes its `tx` client as `db`, making these primitives composable with the
 * T-011 coordinator.
 *
 * **INV-5 (photo variant):**
 * `gallery.length + archivedGallery.length` is conserved by every operation.
 * `featuredImage` is NEVER moved (it always stays in `media.featuredImage` and
 * counts toward the plan cap — callers must account for it in `keepIds`).
 *
 * @module services/plan-photo-restriction
 */

import {
    type DrizzleClient,
    accommodations,
    and,
    eq,
    isNull,
    sql,
    withTransaction
} from '@repo/db';
import type { Image, Media } from '@repo/schemas';
import { apiLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

/**
 * Result returned by {@link archiveAccommodationPhotos} and
 * {@link restoreAccommodationPhotos}.
 */
export interface PhotoArchiveResult {
    /**
     * Number of items moved in this operation. Zero when there was nothing to
     * do (idempotent call or empty archivedGallery).
     */
    readonly movedCount: number;
    /**
     * Total item count (gallery + archivedGallery) after the operation.
     * Callers can assert this equals the pre-operation total for INV-5.
     */
    readonly totalCount: number;
}

// ---------------------------------------------------------------------------
// archiveAccommodationPhotos
// ---------------------------------------------------------------------------

/**
 * Input for {@link archiveAccommodationPhotos}.
 */
export interface ArchiveAccommodationPhotosInput {
    /** UUID of the accommodation whose gallery is to be pruned. */
    readonly accommodationId: string;
    /**
     * URLs of gallery items to KEEP. All other gallery items are moved to
     * `archivedGallery`. An empty set moves every gallery item to archive.
     *
     * Identity key: `url` (the only stable unique field on `ImageSchema`).
     */
    readonly keepIds: ReadonlySet<string>;
    /** Optional Drizzle client (or transaction) for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Moves gallery items NOT in `keepIds` from `media.gallery` to
 * `media.archivedGallery` (append-to-archive semantics).
 *
 * **featuredImage is NEVER moved** — it always stays in `media.featuredImage`
 * and counts toward the plan cap. Callers must account for it when computing
 * `keepIds`.
 *
 * **Idempotent**: calling with the same `keepIds` twice produces the same end
 * state. Items already in `archivedGallery` are not duplicated; only gallery
 * items absent from `keepIds` are moved.
 *
 * **INV-5**: `gallery.length + archivedGallery.length` is conserved.
 * `featuredImage` is not counted.
 *
 * Throws `Error` if the accommodation is not found (deleted or missing).
 *
 * @param input - The accommodation id, keep-set, and optional db client.
 * @returns The number of items moved and the post-operation total count.
 */
export async function archiveAccommodationPhotos(
    input: ArchiveAccommodationPhotosInput
): Promise<PhotoArchiveResult> {
    return withTransaction(async (tx) => {
        // 1. Acquire a pessimistic row lock (M-1: prevents lost-update races under
        //    READ COMMITTED). SELECT id, media FOR UPDATE so we read the media column
        //    under the lock in a single round-trip.
        const lockResult = await tx.execute<{ id: string; media: Media | null }>(
            sql`SELECT id, media FROM accommodations
                WHERE id = ${input.accommodationId}
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE`
        );
        const lockRows = (
            lockResult as unknown as { rows?: Array<{ id: string; media: Media | null }> }
        ).rows;
        const row = lockRows?.[0];

        if (!row) {
            throw new Error(
                `archiveAccommodationPhotos: accommodation not found — id=${input.accommodationId}`
            );
        }

        const media: Media = row.media ?? {};
        const currentGallery: Image[] = media.gallery ?? [];
        const currentArchived: Image[] = media.archivedGallery ?? [];

        // 2. Partition gallery into keep / move
        const toKeep = currentGallery.filter((img) => input.keepIds.has(img.url));
        const toArchive = currentGallery.filter((img) => !input.keepIds.has(img.url));

        // Short-circuit: nothing to move (idempotent case)
        if (toArchive.length === 0) {
            const totalCount = currentGallery.length + currentArchived.length;
            apiLogger.info(
                { accommodationId: input.accommodationId, movedCount: 0, totalCount },
                'plan-restriction photos: archive no-op (all items in keep-set)'
            );
            return { movedCount: 0, totalCount };
        }

        // 3. Build new state — append toArchive to archivedGallery (preserving order)
        const newGallery = toKeep;
        const newArchivedGallery = [...currentArchived, ...toArchive];
        const newMedia: Media = {
            ...media,
            gallery: newGallery,
            archivedGallery: newArchivedGallery
        };

        // 4. Write back
        await tx
            .update(accommodations)
            .set({ media: newMedia, updatedAt: new Date() })
            .where(
                and(eq(accommodations.id, input.accommodationId), isNull(accommodations.deletedAt))
            );

        const movedCount = toArchive.length;
        const totalCount = newGallery.length + newArchivedGallery.length;

        apiLogger.info(
            {
                accommodationId: input.accommodationId,
                movedCount,
                keptCount: newGallery.length,
                archivedTotal: newArchivedGallery.length,
                totalCount
            },
            'plan-restriction photos: archived over-cap gallery items'
        );

        return { movedCount, totalCount };
    }, input.db);
}

// ---------------------------------------------------------------------------
// restoreAccommodationPhotos
// ---------------------------------------------------------------------------

/**
 * Input for {@link restoreAccommodationPhotos}.
 */
export interface RestoreAccommodationPhotosInput {
    /** UUID of the accommodation whose archived photos are to be restored. */
    readonly accommodationId: string;
    /**
     * Number of items to move back from `archivedGallery` to `gallery`.
     * Items are restored FIFO (first-archived first-restored — head of
     * `archivedGallery`). When `restoreCount` >= `archivedGallery.length`,
     * all archived items are restored (full restore).
     *
     * Mutually exclusive with `toCap`. Provide exactly one.
     */
    readonly restoreCount?: number;
    /**
     * Restore enough items so that `gallery.length === toCap`. If
     * `gallery.length` already equals or exceeds `toCap`, this is a no-op.
     * When there are fewer archived items than needed, all archived items are
     * restored (partial fill up to cap).
     *
     * Mutually exclusive with `restoreCount`. Provide exactly one.
     */
    readonly toCap?: number;
    /** Optional Drizzle client (or transaction) for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Moves items from `media.archivedGallery` back to `media.gallery`.
 *
 * Items are restored FIFO (first-archived first-restored — head of the
 * `archivedGallery` array). Provide exactly one of `restoreCount` or `toCap`:
 * - `restoreCount`: move exactly this many items (or all if fewer exist).
 * - `toCap`: restore enough so that `gallery.length === toCap` (capped at
 *   available archived items).
 *
 * **Idempotent**: if `archivedGallery` is empty or `gallery` already meets the
 * cap, returns `{ movedCount: 0, totalCount }` without a DB write.
 *
 * **INV-5**: `gallery.length + archivedGallery.length` is conserved.
 *
 * Throws `Error` if the accommodation is not found, or if neither
 * `restoreCount` nor `toCap` is provided.
 *
 * @param input - The accommodation id, restore target, and optional db client.
 * @returns The number of items moved and the post-operation total count.
 */
export async function restoreAccommodationPhotos(
    input: RestoreAccommodationPhotosInput
): Promise<PhotoArchiveResult> {
    return withTransaction(async (tx) => {
        // 1. Acquire a pessimistic row lock (M-1: prevents lost-update races under
        //    READ COMMITTED). SELECT id, media FOR UPDATE so we read the media column
        //    under the lock in a single round-trip.
        const lockResult = await tx.execute<{ id: string; media: Media | null }>(
            sql`SELECT id, media FROM accommodations
                WHERE id = ${input.accommodationId}
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE`
        );
        const lockRows = (
            lockResult as unknown as { rows?: Array<{ id: string; media: Media | null }> }
        ).rows;
        const row = lockRows?.[0];

        if (!row) {
            throw new Error(
                `restoreAccommodationPhotos: accommodation not found — id=${input.accommodationId}`
            );
        }

        const media: Media = row.media ?? {};
        const currentGallery: Image[] = media.gallery ?? [];
        const currentArchived: Image[] = media.archivedGallery ?? [];

        // 2. Resolve how many to restore
        let count: number;
        if (input.restoreCount !== undefined) {
            count = Math.min(input.restoreCount, currentArchived.length);
        } else if (input.toCap !== undefined) {
            const needed = Math.max(0, input.toCap - currentGallery.length);
            count = Math.min(needed, currentArchived.length);
        } else {
            throw new Error(
                'restoreAccommodationPhotos: provide exactly one of restoreCount or toCap'
            );
        }

        // Short-circuit: nothing to restore
        if (count === 0) {
            const totalCount = currentGallery.length + currentArchived.length;
            apiLogger.info(
                { accommodationId: input.accommodationId, movedCount: 0, totalCount },
                'plan-restriction photos: restore no-op'
            );
            return { movedCount: 0, totalCount };
        }

        // 3. FIFO: take the first `count` items from archivedGallery
        const toRestore = currentArchived.slice(0, count);
        const remainingArchived = currentArchived.slice(count);
        const newGallery = [...currentGallery, ...toRestore];
        const newMedia: Media = {
            ...media,
            gallery: newGallery,
            archivedGallery: remainingArchived
        };

        // 4. Write back
        await tx
            .update(accommodations)
            .set({ media: newMedia, updatedAt: new Date() })
            .where(
                and(eq(accommodations.id, input.accommodationId), isNull(accommodations.deletedAt))
            );

        const movedCount = toRestore.length;
        const totalCount = newGallery.length + remainingArchived.length;

        apiLogger.info(
            {
                accommodationId: input.accommodationId,
                movedCount,
                galleryAfter: newGallery.length,
                archivedAfter: remainingArchived.length,
                totalCount
            },
            'plan-restriction photos: restored archived gallery items'
        );

        return { movedCount, totalCount };
    }, input.db);
}
