import type { VenueMedia } from '@repo/schemas';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { venueMedia } from '../../schemas/venue/venue_media.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { listingMediaShownConditions } from '../listing/listing-media-shown.ts';

/**
 * Input type for `findByVenue` — groups optional filters into a single
 * RO-RO parameter object (Receive Object, Return Object pattern).
 */
interface FindByVenueInput {
    /** The venue listing UUID to load media for. */
    venueId: string;
    /**
     * Filter by visibility state.
     * - `'visible'`  — active gallery photos (and the featured image).
     * - `'archived'` — photos moved out of the gallery.
     * - omit to return all states (both visible and archived).
     */
    state?: 'visible' | 'archived';
    /**
     * Filter by featured flag.
     * - `false` — gallery photos ONLY, excluding the featured image. This is the
     *   count the per-entity gallery cap and the per-plan photo limit are measured
     *   against (HOS-791): the featured image does not occupy a gallery slot.
     * - `true`  — the featured image only.
     * - omit to return both.
     */
    isFeatured?: boolean;
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
    /** The venue listing UUID whose featured image is requested. */
    venueId: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Input type for `findByVenues` (batch read).
 */
interface FindByVenuesInput {
    /** The venue listing UUIDs to load media for (one query, grouped by id). */
    venueIds: readonly string[];
    /**
     * Optional state filter ('visible' | 'archived'). Omit to return all states.
     */
    state?: 'visible' | 'archived';
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Model for venue listing media (gallery photos).
 *
 * Provides the canonical query surface for reading the `venue_media` table.
 * All write operations (create, update, soft-delete, restore) are inherited from
 * `BaseModelImpl` — do not re-implement them here.
 *
 * Key points for callers:
 * - Every finder excludes soft-deleted rows and rows marked for remote deletion
 *   (PB12, AC:V6:30) through `listingMediaShownConditions`.
 * - Gallery ordering is by `sort_order ASC` (not insertion time).
 * - The singleton `venueMediaModel` should be used instead of instantiating
 *   this class directly, unless a custom Drizzle client is required.
 *
 * @see packages/db/src/schemas/venue/venue_media.dbschema.ts — schema +
 *   column docs (mirrors `accommodation_media`, HOS-372).
 * @see packages/db/src/models/accommodation/accommodationMedia.model.ts — the template
 *   this model mirrors field-for-field and finder-for-finder.
 */
export class VenueMediaModel extends BaseModelImpl<VenueMedia> {
    protected table = venueMedia;
    public entityName = 'venueMedia';

    /** Drizzle relational query key — must match the table export name. */
    protected getTableName(): string {
        return 'venueMedia';
    }

    /**
     * Returns the registered relation keys so `findOneWithRelations` /
     * `findAllWithRelations` can warn on unknown keys.
     */
    protected override readonly validRelationKeys = ['venue'] as const;

    // -------------------------------------------------------------------------
    // Venue-media-specific finders
    // -------------------------------------------------------------------------

    /**
     * Lists all non-deleted media rows for a given venue listing, ordered
     * by `sort_order ASC`.
     *
     * This is the canonical gallery-read query used by public and admin consumers.
     * Pass `state: 'visible'` to get the active gallery, `state: 'archived'` to
     * get archived photos for restore operations, or omit `state` to return all.
     *
     * Pagination is mandatory (inherited `BaseModelImpl.findAll` cap applies — max
     * 200 rows per page). For a listing that has never exceeded ~200 photos the
     * default `pageSize: 50` is sufficient for a single-page load.
     *
     * @param input.venueId - UUID of the parent venue listing.
     * @param input.state        - Optional state filter ('visible' | 'archived').
     * @param input.isFeatured   - Optional featured filter. Pass `false` to count
     *                             gallery photos only, excluding the featured image (HOS-791).
     * @param input.page         - 1-based page number (default 1).
     * @param input.pageSize     - Rows per page (default 50, max 200 via BaseModel).
     * @param input.tx           - Optional transaction client.
     * @returns Paginated list of media rows + total count.
     */
    async findByVenue(input: FindByVenueInput): Promise<{ items: VenueMedia[]; total: number }> {
        const { venueId, state, isFeatured, page = 1, pageSize = 50, tx } = input;
        const db = this.getClient(tx);
        const logContext = { venueId, state, isFeatured, page, pageSize };

        try {
            const conditions = [
                eq(venueMedia.venueId, venueId),
                ...listingMediaShownConditions({ table: venueMedia })
            ];
            if (state !== undefined) {
                conditions.push(eq(venueMedia.state, state));
            }
            if (isFeatured !== undefined) {
                conditions.push(eq(venueMedia.isFeatured, isFeatured));
            }

            const whereClause = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(venueMedia)
                    .where(whereClause)
                    .orderBy(asc(venueMedia.sortOrder))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(venueMedia).where(whereClause)
            ]);

            const result = {
                items: items as VenueMedia[],
                total: Number(countResult[0]?.count ?? 0)
            };
            try {
                logQuery(this.entityName, 'findByGastronomy', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByGastronomy', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByGastronomy', logContext, err.message);
        }
    }

    /**
     * Returns the featured image row for a given venue listing, or `null`
     * when none exists.
     *
     * At most one non-deleted row can have `is_featured = true` per listing — a
     * partial unique index (extras carril) enforces this at the DB level. This
     * finder intentionally does NOT use a LIMIT hint beyond what the index
     * guarantees.
     *
     * @param input.venueId - UUID of the parent venue listing.
     * @param input.tx           - Optional transaction client.
     * @returns The featured media row, or `null` if no featured image is set.
     */
    async findFeatured(input: FindFeaturedInput): Promise<VenueMedia | null> {
        const { venueId, tx } = input;
        const db = this.getClient(tx);
        const logContext = { venueId };

        try {
            const result = await db
                .select()
                .from(venueMedia)
                .where(
                    and(
                        eq(venueMedia.venueId, venueId),
                        eq(venueMedia.isFeatured, true),
                        ...listingMediaShownConditions({ table: venueMedia })
                    )
                )
                .limit(1);

            const row = (result[0] as VenueMedia) ?? null;
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

    /**
     * Batch-loads non-deleted media rows for multiple venue listings in a
     * single query, grouped by `venueId`. This is the canonical read used
     * by list/search composition to avoid the N+1 that would result from
     * calling {@link findByVenue} once per list item.
     *
     * Rows are returned ordered by `sort_order ASC` within each listing's
     * array (the SQL `ORDER BY` is global, but `sort_order` is the only ordering
     * key and grouping preserves it). Listings with no media are simply absent
     * from the returned map — callers should default to `[]`.
     *
     * Unlike {@link findByVenue} this finder is intentionally NOT paginated:
     * it loads the full media set for the given ids so composition is complete. A
     * single list page of listings x their galleries stays well within a
     * reasonable row budget.
     *
     * @param input.venueIds - UUIDs to load (empty array → empty map, no query).
     * @param input.state         - Optional state filter ('visible' | 'archived').
     * @param input.tx            - Optional transaction client.
     * @returns Map of venueId → ordered media rows.
     */
    async findByVenues(input: FindByVenuesInput): Promise<Map<string, VenueMedia[]>> {
        const { venueIds, state, tx } = input;
        const grouped = new Map<string, VenueMedia[]>();
        if (venueIds.length === 0) return grouped;

        const db = this.getClient(tx);
        const logContext = { count: venueIds.length, state };

        try {
            const conditions = [
                inArray(venueMedia.venueId, [...venueIds]),
                ...listingMediaShownConditions({ table: venueMedia })
            ];
            if (state !== undefined) {
                conditions.push(eq(venueMedia.state, state));
            }

            // Secondary sort by `id` guarantees a deterministic order even when two
            // rows of the same listing share a `sort_order` value (should not happen
            // by design, but keeps the composed gallery order stable regardless).
            const rows = (await db
                .select()
                .from(venueMedia)
                .where(and(...conditions))
                .orderBy(asc(venueMedia.sortOrder), asc(venueMedia.id))) as VenueMedia[];

            for (const row of rows) {
                const list = grouped.get(row.venueId);
                if (list) {
                    list.push(row);
                } else {
                    grouped.set(row.venueId, [row]);
                }
            }
            try {
                logQuery(this.entityName, 'findByGastronomies', logContext, {
                    venues: grouped.size,
                    rows: rows.length
                });
            } catch {}
            return grouped;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByGastronomies', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByGastronomies', logContext, err.message);
        }
    }
}

/**
 * Singleton instance of `VenueMediaModel`.
 *
 * Use this exported constant across the application instead of constructing a new
 * instance. The underlying Drizzle client is resolved lazily via `getDb()` on each
 * operation, so the singleton is safe to import at module load time.
 */
export const venueMediaModel = new VenueMediaModel();
