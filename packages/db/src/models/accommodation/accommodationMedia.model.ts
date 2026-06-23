import { and, asc, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import {
    type SelectAccommodationMedia,
    accommodationMedia
} from '../../schemas/accommodation/accommodation_media.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input type for `findByAccommodation` — groups optional filters into a single
 * RO-RO parameter object (Receive Object, Return Object pattern).
 */
interface FindByAccommodationInput {
    /** The accommodation UUID to load media for. */
    accommodationId: string;
    /**
     * Filter by visibility state.
     * - `'visible'`  — active gallery photos (and the featured image).
     * - `'archived'` — photos moved out of the gallery on a plan downgrade.
     * - omit to return all states (both visible and archived).
     */
    state?: 'visible' | 'archived';
    /** Pagination: 1-based page number. Defaults to 1. */
    page?: number;
    /** Pagination: maximum rows per page. Defaults to 50. */
    pageSize?: number;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Input type for `findFeatured`.
 */
interface FindFeaturedInput {
    /** The accommodation UUID whose featured image is requested. */
    accommodationId: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Model for accommodation media (gallery photos).
 *
 * Provides the canonical query surface for reading the `accommodation_media` table.
 * All write operations (create, update, soft-delete, restore) are inherited from
 * `BaseModelImpl` — do not re-implement them here.
 *
 * Key points for callers:
 * - Every finder excludes soft-deleted rows (`deletedAt IS NULL`) by default.
 * - Gallery ordering is by `sort_order ASC` (not insertion time).
 * - The singleton `accommodationMediaModel` should be used instead of instantiating
 *   this class directly, unless a custom Drizzle client is required.
 *
 * @see packages/db/src/schemas/accommodation/accommodation_media.dbschema.ts — schema +
 *   column docs (D1/D2/D3 decisions).
 * @see packages/db/src/migrations/extras/ — T-003 partial-unique index on `is_featured`
 *   and CHECK constraint enforcing `is_featured ⇒ NOT archived`.
 */
export class AccommodationMediaModel extends BaseModelImpl<SelectAccommodationMedia> {
    protected table = accommodationMedia;
    public entityName = 'accommodationMedia';

    /** Drizzle relational query key — must match the table export name. */
    protected getTableName(): string {
        return 'accommodationMedia';
    }

    /**
     * Returns the registered relation keys so `findOneWithRelations` /
     * `findAllWithRelations` can warn on unknown keys.
     */
    protected override readonly validRelationKeys = ['accommodation'] as const;

    // -------------------------------------------------------------------------
    // Accommodation-media-specific finders
    // -------------------------------------------------------------------------

    /**
     * Lists all non-deleted media rows for a given accommodation, ordered by
     * `sort_order ASC`.
     *
     * This is the canonical gallery-read query used by public and admin consumers.
     * Pass `state: 'visible'` to get the active gallery, `state: 'archived'` to
     * get archived photos for restore operations, or omit `state` to return all.
     *
     * Pagination is mandatory (inherited `BaseModelImpl.findAll` cap applies — max
     * 200 rows per page). For an accommodation that has never exceeded ~200 photos
     * the default `pageSize: 50` is sufficient for a single-page load.
     *
     * @param input.accommodationId - UUID of the parent accommodation.
     * @param input.state           - Optional state filter ('visible' | 'archived').
     * @param input.page            - 1-based page number (default 1).
     * @param input.pageSize        - Rows per page (default 50, max 200 via BaseModel).
     * @param input.tx              - Optional transaction client.
     * @returns Paginated list of media rows + total count.
     */
    async findByAccommodation(
        input: FindByAccommodationInput
    ): Promise<{ items: SelectAccommodationMedia[]; total: number }> {
        const { accommodationId, state, page = 1, pageSize = 50, tx } = input;
        const db = this.getClient(tx);
        const logContext = { accommodationId, state, page, pageSize };

        try {
            const conditions = [
                eq(accommodationMedia.accommodationId, accommodationId),
                isNull(accommodationMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(accommodationMedia.state, state));
            }

            const whereClause = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(accommodationMedia)
                    .where(whereClause)
                    .orderBy(asc(accommodationMedia.sortOrder))
                    .limit(pageSize)
                    .offset(offset),
                db
                    .select({ count: accommodationMedia.id })
                    .from(accommodationMedia)
                    .where(whereClause)
            ]);

            const result = {
                items: items as SelectAccommodationMedia[],
                total: countResult.length
            };
            try {
                logQuery(this.entityName, 'findByAccommodation', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByAccommodation', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByAccommodation', logContext, err.message);
        }
    }

    /**
     * Returns the featured image row for a given accommodation, or `null` when none exists.
     *
     * At most one non-deleted row can have `is_featured = true` per accommodation — the
     * partial unique index (T-003 extras) enforces this at the DB level. This finder
     * intentionally does NOT use a LIMIT hint beyond what the index guarantees.
     *
     * @param input.accommodationId - UUID of the parent accommodation.
     * @param input.tx              - Optional transaction client.
     * @returns The featured media row, or `null` if no featured image is set.
     */
    async findFeatured(input: FindFeaturedInput): Promise<SelectAccommodationMedia | null> {
        const { accommodationId, tx } = input;
        const db = this.getClient(tx);
        const logContext = { accommodationId };

        try {
            const result = await db
                .select()
                .from(accommodationMedia)
                .where(
                    and(
                        eq(accommodationMedia.accommodationId, accommodationId),
                        eq(accommodationMedia.isFeatured, true),
                        isNull(accommodationMedia.deletedAt)
                    )
                )
                .limit(1);

            const row = (result[0] as SelectAccommodationMedia) ?? null;
            try {
                logQuery(this.entityName, 'findFeatured', logContext, row);
            } catch {}
            return row;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findFeatured', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findFeatured', logContext, err.message);
        }
    }
}

/**
 * Singleton instance of `AccommodationMediaModel`.
 *
 * Use this exported constant across the application instead of constructing a new
 * instance. The underlying Drizzle client is resolved lazily via `getDb()` on each
 * operation, so the singleton is safe to import at module load time.
 */
export const accommodationMediaModel = new AccommodationMediaModel();
