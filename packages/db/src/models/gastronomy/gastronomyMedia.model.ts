import type { GastronomyMedia } from '@repo/schemas';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { gastronomyMedia } from '../../schemas/gastronomy/gastronomy_media.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input type for `findByGastronomy` — groups optional filters into a single
 * RO-RO parameter object (Receive Object, Return Object pattern).
 */
interface FindByGastronomyInput {
    /** The gastronomy listing UUID to load media for. */
    gastronomyId: string;
    /**
     * Filter by visibility state.
     * - `'visible'`  — active gallery photos (and the featured image).
     * - `'archived'` — photos moved out of the gallery.
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
    /** The gastronomy listing UUID whose featured image is requested. */
    gastronomyId: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Input type for `findByGastronomies` (batch read).
 */
interface FindByGastronomiesInput {
    /** The gastronomy listing UUIDs to load media for (one query, grouped by id). */
    gastronomyIds: readonly string[];
    /**
     * Optional state filter ('visible' | 'archived'). Omit to return all states.
     */
    state?: 'visible' | 'archived';
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Model for gastronomy listing media (gallery photos).
 *
 * Provides the canonical query surface for reading the `gastronomy_media` table.
 * All write operations (create, update, soft-delete, restore) are inherited from
 * `BaseModelImpl` — do not re-implement them here.
 *
 * Key points for callers:
 * - Every finder excludes soft-deleted rows (`deletedAt IS NULL`) by default.
 * - Gallery ordering is by `sort_order ASC` (not insertion time).
 * - The singleton `gastronomyMediaModel` should be used instead of instantiating
 *   this class directly, unless a custom Drizzle client is required.
 *
 * @see packages/db/src/schemas/gastronomy/gastronomy_media.dbschema.ts — schema +
 *   column docs (mirrors `accommodation_media`, HOS-372).
 * @see packages/db/src/models/accommodation/accommodationMedia.model.ts — the template
 *   this model mirrors field-for-field and finder-for-finder.
 */
export class GastronomyMediaModel extends BaseModelImpl<GastronomyMedia> {
    protected table = gastronomyMedia;
    public entityName = 'gastronomyMedia';

    /** Drizzle relational query key — must match the table export name. */
    protected getTableName(): string {
        return 'gastronomyMedia';
    }

    /**
     * Returns the registered relation keys so `findOneWithRelations` /
     * `findAllWithRelations` can warn on unknown keys.
     */
    protected override readonly validRelationKeys = ['gastronomy'] as const;

    // -------------------------------------------------------------------------
    // Gastronomy-media-specific finders
    // -------------------------------------------------------------------------

    /**
     * Lists all non-deleted media rows for a given gastronomy listing, ordered
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
     * @param input.gastronomyId - UUID of the parent gastronomy listing.
     * @param input.state        - Optional state filter ('visible' | 'archived').
     * @param input.page         - 1-based page number (default 1).
     * @param input.pageSize     - Rows per page (default 50, max 200 via BaseModel).
     * @param input.tx           - Optional transaction client.
     * @returns Paginated list of media rows + total count.
     */
    async findByGastronomy(
        input: FindByGastronomyInput
    ): Promise<{ items: GastronomyMedia[]; total: number }> {
        const { gastronomyId, state, page = 1, pageSize = 50, tx } = input;
        const db = this.getClient(tx);
        const logContext = { gastronomyId, state, page, pageSize };

        try {
            const conditions = [
                eq(gastronomyMedia.gastronomyId, gastronomyId),
                isNull(gastronomyMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(gastronomyMedia.state, state));
            }

            const whereClause = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(gastronomyMedia)
                    .where(whereClause)
                    .orderBy(asc(gastronomyMedia.sortOrder))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(gastronomyMedia).where(whereClause)
            ]);

            const result = {
                items: items as GastronomyMedia[],
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
     * Returns the featured image row for a given gastronomy listing, or `null`
     * when none exists.
     *
     * At most one non-deleted row can have `is_featured = true` per listing — a
     * partial unique index (extras carril) enforces this at the DB level. This
     * finder intentionally does NOT use a LIMIT hint beyond what the index
     * guarantees.
     *
     * @param input.gastronomyId - UUID of the parent gastronomy listing.
     * @param input.tx           - Optional transaction client.
     * @returns The featured media row, or `null` if no featured image is set.
     */
    async findFeatured(input: FindFeaturedInput): Promise<GastronomyMedia | null> {
        const { gastronomyId, tx } = input;
        const db = this.getClient(tx);
        const logContext = { gastronomyId };

        try {
            const result = await db
                .select()
                .from(gastronomyMedia)
                .where(
                    and(
                        eq(gastronomyMedia.gastronomyId, gastronomyId),
                        eq(gastronomyMedia.isFeatured, true),
                        isNull(gastronomyMedia.deletedAt)
                    )
                )
                .limit(1);

            const row = (result[0] as GastronomyMedia) ?? null;
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
     * Batch-loads non-deleted media rows for multiple gastronomy listings in a
     * single query, grouped by `gastronomyId`. This is the canonical read used
     * by list/search composition to avoid the N+1 that would result from
     * calling {@link findByGastronomy} once per list item.
     *
     * Rows are returned ordered by `sort_order ASC` within each listing's
     * array (the SQL `ORDER BY` is global, but `sort_order` is the only ordering
     * key and grouping preserves it). Listings with no media are simply absent
     * from the returned map — callers should default to `[]`.
     *
     * Unlike {@link findByGastronomy} this finder is intentionally NOT paginated:
     * it loads the full media set for the given ids so composition is complete. A
     * single list page of listings x their galleries stays well within a
     * reasonable row budget.
     *
     * @param input.gastronomyIds - UUIDs to load (empty array → empty map, no query).
     * @param input.state         - Optional state filter ('visible' | 'archived').
     * @param input.tx            - Optional transaction client.
     * @returns Map of gastronomyId → ordered media rows.
     */
    async findByGastronomies(
        input: FindByGastronomiesInput
    ): Promise<Map<string, GastronomyMedia[]>> {
        const { gastronomyIds, state, tx } = input;
        const grouped = new Map<string, GastronomyMedia[]>();
        if (gastronomyIds.length === 0) return grouped;

        const db = this.getClient(tx);
        const logContext = { count: gastronomyIds.length, state };

        try {
            const conditions = [
                inArray(gastronomyMedia.gastronomyId, [...gastronomyIds]),
                isNull(gastronomyMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(gastronomyMedia.state, state));
            }

            // Secondary sort by `id` guarantees a deterministic order even when two
            // rows of the same listing share a `sort_order` value (should not happen
            // by design, but keeps the composed gallery order stable regardless).
            const rows = (await db
                .select()
                .from(gastronomyMedia)
                .where(and(...conditions))
                .orderBy(
                    asc(gastronomyMedia.sortOrder),
                    asc(gastronomyMedia.id)
                )) as GastronomyMedia[];

            for (const row of rows) {
                const list = grouped.get(row.gastronomyId);
                if (list) {
                    list.push(row);
                } else {
                    grouped.set(row.gastronomyId, [row]);
                }
            }
            try {
                logQuery(this.entityName, 'findByGastronomies', logContext, {
                    gastronomies: grouped.size,
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
 * Singleton instance of `GastronomyMediaModel`.
 *
 * Use this exported constant across the application instead of constructing a new
 * instance. The underlying Drizzle client is resolved lazily via `getDb()` on each
 * operation, so the singleton is safe to import at module load time.
 */
export const gastronomyMediaModel = new GastronomyMediaModel();
