/**
 * Photo Archive/Restore Primitives (SPEC-167 T-009 / SPEC-204 direct cutover).
 *
 * Operates SOLELY on the `accommodation_media` relational table. The JSONB
 * `media` blob is no longer read or written by these primitives. The
 * dual-write that was labeled "SPEC-204 T-008" is now the ONLY write.
 *
 * **Identity key — `url`:**
 * `ImageSchema` has no stable `id` field. The `url` string is the sole unique
 * identity key used by `keepIds` and all photo primitives. Callers must supply
 * fully-qualified image URLs.
 *
 * **Restore order — FIFO via `archivedAt`:**
 * Items are restored in ascending `archivedAt` order (earliest archived first).
 * `archivedAt` is set when a row transitions to `state='archived'` and persisted
 * across accommodation edits (the replace-all path in `accommodation.media-sync`
 * was the P1 limitation that reset it; now the archive write is the sole path
 * that stamps `archivedAt`).
 *
 * **Sort order on restore:**
 * The old JSONB behavior appended restored items at the END of the gallery.
 * We replicate this by assigning a `sortOrder` that starts after the current
 * maximum visible `sortOrder`. Featured image occupies sort_order 0 and is
 * excluded from the max calculation by the `is_featured=false` filter.
 *
 * **Concurrency safety (M-1):**
 * The read-modify-write runs inside `withTransaction` AND acquires a
 * pessimistic row lock via `SELECT id FROM accommodations ... FOR UPDATE`
 * before reading `accommodation_media`. This prevents lost-update races
 * against concurrent media writers (e.g. host edits) that run under
 * PostgreSQL's default READ COMMITTED isolation. `withTransaction` reuses an
 * outer transaction when the caller passes its `tx` client as `db`, making
 * these primitives composable with the T-011 coordinator.
 *
 * **INV-5 (photo variant):**
 * `visible_count + archived_count` is conserved by every operation.
 * `featuredImage` is NEVER archived (guaranteed by the `is_featured=false`
 * filter on reads and the DB CHECK constraint).
 *
 * @module services/plan-photo-restriction
 */

import {
    type DrizzleClient,
    accommodationMedia,
    and,
    asc,
    eq,
    inArray,
    isNull,
    max,
    sql,
    withTransaction
} from '@repo/db';
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
     * do (idempotent call or empty archived set).
     */
    readonly movedCount: number;
    /**
     * Total item count (visible + archived, excluding featuredImage) after the
     * operation. Callers can assert this equals the pre-operation total for INV-5.
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
     * URLs of gallery items to KEEP visible. All other non-featured visible items
     * are moved to `state='archived'`. An empty set archives every visible
     * non-featured photo.
     *
     * Identity key: `url` (the only stable unique field on `ImageSchema`).
     */
    readonly keepIds: ReadonlySet<string>;
    /** Optional Drizzle client (or transaction) for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Archives non-featured gallery items NOT present in `keepIds`.
 *
 * Reads the current visible non-featured photos from `accommodation_media`
 * (under the row lock), partitions them by `keepIds`, and flips the
 * "to-archive" set to `state='archived', archivedAt=NOW()` in the same
 * transaction. The JSONB `media` blob is NOT read or written.
 *
 * **featuredImage is NEVER archived** — the `is_featured=false` filter ensures
 * featured rows are never in the candidate set, and the DB CHECK constraint
 * enforces the same invariant at the DB level.
 *
 * **Idempotent**: calling with the same `keepIds` when nothing has changed
 * produces `movedCount=0` with no DB write.
 *
 * **INV-5**: `visible_count + archived_count` is conserved (non-featured rows
 * only; featuredImage is not counted).
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
        //    READ COMMITTED). We no longer need to read `media` from the JSONB column
        //    — the lock on the accommodation row stays as the per-accommodation write
        //    coordinator; the actual data comes from accommodation_media below.
        const lockResult = await tx.execute<{ id: string }>(
            sql`SELECT id FROM accommodations
                WHERE id = ${input.accommodationId}
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE`
        );
        // TYPE-WORKAROUND: Drizzle execute() returns an opaque QueryResult; rows are at .rows on pg driver.
        const lockRows = (lockResult as unknown as { rows?: Array<{ id: string }> }).rows;
        const lockRow = lockRows?.[0];

        if (!lockRow) {
            throw new Error(
                `archiveAccommodationPhotos: accommodation not found — id=${input.accommodationId}`
            );
        }

        // 2. Read visible non-featured rows from the relational table (under the lock).
        //    Featured image is excluded by `is_featured=false` — it can never be archived.
        const visibleRows = await tx
            .select({ url: accommodationMedia.url })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.state, 'visible'),
                    eq(accommodationMedia.isFeatured, false),
                    isNull(accommodationMedia.deletedAt)
                )
            );

        // 3. Count archived rows (needed for totalCount / INV-5).
        const archivedCountRows = await tx
            .select({ url: accommodationMedia.url })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.state, 'archived'),
                    isNull(accommodationMedia.deletedAt)
                )
            );

        const visibleUrls = visibleRows.map((r) => r.url);
        const toArchiveUrls = visibleUrls.filter((url) => !input.keepIds.has(url));
        const currentArchivedCount = archivedCountRows.length;

        // Short-circuit: nothing to archive (idempotent case)
        if (toArchiveUrls.length === 0) {
            const totalCount = visibleUrls.length + currentArchivedCount;
            apiLogger.info(
                { accommodationId: input.accommodationId, movedCount: 0, totalCount },
                'plan-restriction photos: archive no-op (all visible items in keep-set)'
            );
            return { movedCount: 0, totalCount };
        }

        // 4. Flip the to-archive URLs to state='archived', stamp archivedAt=NOW().
        await tx
            .update(accommodationMedia)
            .set({ state: 'archived', archivedAt: new Date(), updatedAt: new Date() })
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    inArray(accommodationMedia.url, toArchiveUrls),
                    eq(accommodationMedia.state, 'visible'),
                    isNull(accommodationMedia.deletedAt)
                )
            );

        const movedCount = toArchiveUrls.length;
        const keptCount = visibleUrls.length - movedCount;
        const newArchivedCount = currentArchivedCount + movedCount;
        const totalCount = keptCount + newArchivedCount;

        apiLogger.info(
            {
                accommodationId: input.accommodationId,
                movedCount,
                keptCount,
                archivedTotal: newArchivedCount,
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
     * Number of items to move back from `archived` to `visible` state.
     * Items are restored FIFO (oldest `archivedAt` first). When `restoreCount`
     * >= the archived count, all archived items are restored (full restore).
     *
     * Mutually exclusive with `toCap`. Provide exactly one.
     */
    readonly restoreCount?: number;
    /**
     * Restore enough items so that `visible_gallery_count + (hasFeaturedImage ? 1 : 0) === toCap`.
     * In other words, `toCap` is the TOTAL plan cap (gallery + featuredImage combined).
     * The primitive reserves one slot for `featuredImage` when it is present, so the
     * effective gallery target is `toCap - 1`. If the gallery already meets or exceeds
     * the effective target, this is a no-op. When there are fewer archived items than
     * needed, all archived items are restored (partial fill up to cap).
     *
     * This is symmetric with the downgrade restriction side, which computes
     * `gallerySlots = cap - (hasFeaturedImage ? 1 : 0)` before archiving.
     *
     * Mutually exclusive with `restoreCount`. Provide exactly one.
     */
    readonly toCap?: number;
    /** Optional Drizzle client (or transaction) for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Restores archived `accommodation_media` rows back to `state='visible'`.
 *
 * Items are selected FIFO by `archivedAt ASC` (earliest archived first).
 * Restored rows are appended after the current maximum visible `sortOrder`
 * to replicate the old JSONB behavior (gallery = [...gallery, ...restored]).
 *
 * Provide exactly one of `restoreCount` or `toCap`:
 * - `restoreCount`: move exactly this many items (or all if fewer exist).
 * - `toCap`: restore enough so that the TOTAL occupied cap slots
 *   (visible gallery + featuredImage) equal `toCap`.
 *
 * **Idempotent**: if no archived rows exist or the gallery already meets the
 * cap, returns `{ movedCount: 0, totalCount }` without a DB write.
 *
 * **INV-5**: `visible_count + archived_count` is conserved.
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
        //    READ COMMITTED). The lock is on the accommodations row; actual data
        //    comes from accommodation_media reads below.
        const lockResult = await tx.execute<{ id: string }>(
            sql`SELECT id FROM accommodations
                WHERE id = ${input.accommodationId}
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE`
        );
        // TYPE-WORKAROUND: Drizzle execute() returns an opaque QueryResult; rows are at .rows on pg driver.
        const lockRows = (lockResult as unknown as { rows?: Array<{ id: string }> }).rows;
        const lockRow = lockRows?.[0];

        if (!lockRow) {
            throw new Error(
                `restoreAccommodationPhotos: accommodation not found — id=${input.accommodationId}`
            );
        }

        // 2a. Determine if there is a featured image (for toCap seat reservation).
        //     Count visible rows that are is_featured=true.
        const featuredRows = await tx
            .select({ url: accommodationMedia.url })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.isFeatured, true),
                    eq(accommodationMedia.state, 'visible'),
                    isNull(accommodationMedia.deletedAt)
                )
            );
        const hasFeaturedImage = featuredRows.length > 0;

        // 2b. Read current visible gallery count (non-featured, visible rows).
        const visibleGalleryRows = await tx
            .select({ url: accommodationMedia.url })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.state, 'visible'),
                    eq(accommodationMedia.isFeatured, false),
                    isNull(accommodationMedia.deletedAt)
                )
            );
        const currentGalleryCount = visibleGalleryRows.length;

        // 2c. Fetch ALL archived rows ordered FIFO (archivedAt ASC = oldest first).
        //     We read them all so we can compute totalCount accurately regardless
        //     of how many we actually restore.
        const archivedRows = await tx
            .select({ url: accommodationMedia.url, archivedAt: accommodationMedia.archivedAt })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.state, 'archived'),
                    isNull(accommodationMedia.deletedAt)
                )
            )
            .orderBy(asc(accommodationMedia.archivedAt));

        const currentArchivedCount = archivedRows.length;

        // 3. Resolve how many to restore.
        let count: number;
        if (input.restoreCount !== undefined) {
            count = Math.min(input.restoreCount, currentArchivedCount);
        } else if (input.toCap !== undefined) {
            // M-3: toCap is the TOTAL plan cap (gallery + featuredImage combined).
            // Reserve one slot for featuredImage when present — symmetric with the
            // restriction side: gallerySlots = cap - (hasFeaturedImage ? 1 : 0).
            const galleryTarget = Math.max(0, input.toCap - (hasFeaturedImage ? 1 : 0));
            const needed = Math.max(0, galleryTarget - currentGalleryCount);
            count = Math.min(needed, currentArchivedCount);
        } else {
            throw new Error(
                'restoreAccommodationPhotos: provide exactly one of restoreCount or toCap'
            );
        }

        // Short-circuit: nothing to restore
        if (count === 0) {
            const totalCount = currentGalleryCount + currentArchivedCount;
            apiLogger.info(
                { accommodationId: input.accommodationId, movedCount: 0, totalCount },
                'plan-restriction photos: restore no-op'
            );
            return { movedCount: 0, totalCount };
        }

        // 4. FIFO: take the `count` oldest archived rows (already sorted by archivedAt ASC).
        const toRestore = archivedRows.slice(0, count);
        const toRestoreUrls = toRestore.map((r) => r.url);

        // 5. Compute the sortOrder base for restored rows.
        //    Replicate the old JSONB append-to-end behavior: restored items get
        //    sortOrder values starting after the current maximum visible sortOrder.
        //    If there are no visible gallery rows yet, start at 0 (or 1 if featured
        //    holds sort_order 0).
        const maxSortOrderRows = await tx
            .select({ maxOrder: max(accommodationMedia.sortOrder) })
            .from(accommodationMedia)
            .where(
                and(
                    eq(accommodationMedia.accommodationId, input.accommodationId),
                    eq(accommodationMedia.state, 'visible'),
                    isNull(accommodationMedia.deletedAt)
                )
            );
        // max() returns null when there are no matching rows.
        const currentMaxSortOrder = maxSortOrderRows[0]?.maxOrder ?? -1;

        // 6. Flip the to-restore rows to state='visible', clear archivedAt, assign sortOrder.
        //    We update one row at a time to assign unique sortOrder values.
        const now = new Date();
        for (let i = 0; i < toRestoreUrls.length; i++) {
            const url = toRestoreUrls[i];
            if (!url) continue;
            await tx
                .update(accommodationMedia)
                .set({
                    state: 'visible',
                    archivedAt: null,
                    sortOrder: currentMaxSortOrder + 1 + i,
                    updatedAt: now
                })
                .where(
                    and(
                        eq(accommodationMedia.accommodationId, input.accommodationId),
                        eq(accommodationMedia.url, url),
                        eq(accommodationMedia.state, 'archived'),
                        isNull(accommodationMedia.deletedAt)
                    )
                );
        }

        const movedCount = toRestoreUrls.length;
        const remainingArchivedCount = currentArchivedCount - movedCount;
        const totalCount = currentGalleryCount + movedCount + remainingArchivedCount;

        apiLogger.info(
            {
                accommodationId: input.accommodationId,
                movedCount,
                galleryAfter: currentGalleryCount + movedCount,
                archivedAfter: remainingArchivedCount,
                totalCount
            },
            'plan-restriction photos: restored archived gallery items'
        );

        return { movedCount, totalCount };
    }, input.db);
}
