import type { ExperienceMedia } from '@repo/schemas';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { experienceMedia } from '../../schemas/experience/experience_media.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input type for `findByExperience` — groups optional filters into a single
 * RO-RO parameter object (Receive Object, Return Object pattern).
 */
interface FindByExperienceInput {
    /** The experience listing UUID to load media for. */
    experienceId: string;
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
    /** The experience listing UUID whose featured image is requested. */
    experienceId: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Input type for `findByExperiences` (batch read).
 */
interface FindByExperiencesInput {
    /** The experience listing UUIDs to load media for (one query, grouped by id). */
    experienceIds: readonly string[];
    /**
     * Optional state filter ('visible' | 'archived'). Omit to return all states.
     */
    state?: 'visible' | 'archived';
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Model for experience listing media (gallery photos).
 *
 * Provides the canonical query surface for reading the `experience_media` table.
 * All write operations (create, update, soft-delete, restore) are inherited from
 * `BaseModelImpl` — do not re-implement them here.
 *
 * Key points for callers:
 * - Every finder excludes soft-deleted rows (`deletedAt IS NULL`) by default.
 * - Gallery ordering is by `sort_order ASC` (not insertion time).
 * - The singleton `experienceMediaModel` should be used instead of instantiating
 *   this class directly, unless a custom Drizzle client is required.
 *
 * @see packages/db/src/schemas/experience/experience_media.dbschema.ts — schema +
 *   column docs (mirrors `accommodation_media`, HOS-372).
 * @see packages/db/src/models/accommodation/accommodationMedia.model.ts — the template
 *   this model mirrors field-for-field and finder-for-finder.
 */
export class ExperienceMediaModel extends BaseModelImpl<ExperienceMedia> {
    protected table = experienceMedia;
    public entityName = 'experienceMedia';

    /** Drizzle relational query key — must match the table export name. */
    protected getTableName(): string {
        return 'experienceMedia';
    }

    /**
     * Returns the registered relation keys so `findOneWithRelations` /
     * `findAllWithRelations` can warn on unknown keys.
     */
    protected override readonly validRelationKeys = ['experience'] as const;

    // -------------------------------------------------------------------------
    // Experience-media-specific finders
    // -------------------------------------------------------------------------

    /**
     * Lists all non-deleted media rows for a given experience listing, ordered
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
     * @param input.experienceId - UUID of the parent experience listing.
     * @param input.state        - Optional state filter ('visible' | 'archived').
     * @param input.page         - 1-based page number (default 1).
     * @param input.pageSize     - Rows per page (default 50, max 200 via BaseModel).
     * @param input.tx           - Optional transaction client.
     * @returns Paginated list of media rows + total count.
     */
    async findByExperience(
        input: FindByExperienceInput
    ): Promise<{ items: ExperienceMedia[]; total: number }> {
        const { experienceId, state, page = 1, pageSize = 50, tx } = input;
        const db = this.getClient(tx);
        const logContext = { experienceId, state, page, pageSize };

        try {
            const conditions = [
                eq(experienceMedia.experienceId, experienceId),
                isNull(experienceMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(experienceMedia.state, state));
            }

            const whereClause = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(experienceMedia)
                    .where(whereClause)
                    .orderBy(asc(experienceMedia.sortOrder))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(experienceMedia).where(whereClause)
            ]);

            const result = {
                items: items as ExperienceMedia[],
                total: Number(countResult[0]?.count ?? 0)
            };
            try {
                logQuery(this.entityName, 'findByExperience', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByExperience', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByExperience', logContext, err.message);
        }
    }

    /**
     * Returns the featured image row for a given experience listing, or `null`
     * when none exists.
     *
     * At most one non-deleted row can have `is_featured = true` per listing — a
     * partial unique index (extras carril) enforces this at the DB level. This
     * finder intentionally does NOT use a LIMIT hint beyond what the index
     * guarantees.
     *
     * @param input.experienceId - UUID of the parent experience listing.
     * @param input.tx           - Optional transaction client.
     * @returns The featured media row, or `null` if no featured image is set.
     */
    async findFeatured(input: FindFeaturedInput): Promise<ExperienceMedia | null> {
        const { experienceId, tx } = input;
        const db = this.getClient(tx);
        const logContext = { experienceId };

        try {
            const result = await db
                .select()
                .from(experienceMedia)
                .where(
                    and(
                        eq(experienceMedia.experienceId, experienceId),
                        eq(experienceMedia.isFeatured, true),
                        isNull(experienceMedia.deletedAt)
                    )
                )
                .limit(1);

            const row = (result[0] as ExperienceMedia) ?? null;
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
     * Batch-loads non-deleted media rows for multiple experience listings in a
     * single query, grouped by `experienceId`. This is the canonical read used
     * by list/search composition to avoid the N+1 that would result from
     * calling {@link findByExperience} once per list item.
     *
     * Rows are returned ordered by `sort_order ASC` within each listing's
     * array (the SQL `ORDER BY` is global, but `sort_order` is the only ordering
     * key and grouping preserves it). Listings with no media are simply absent
     * from the returned map — callers should default to `[]`.
     *
     * Unlike {@link findByExperience} this finder is intentionally NOT paginated:
     * it loads the full media set for the given ids so composition is complete. A
     * single list page of listings x their galleries stays well within a
     * reasonable row budget.
     *
     * @param input.experienceIds - UUIDs to load (empty array → empty map, no query).
     * @param input.state         - Optional state filter ('visible' | 'archived').
     * @param input.tx            - Optional transaction client.
     * @returns Map of experienceId → ordered media rows.
     */
    async findByExperiences(
        input: FindByExperiencesInput
    ): Promise<Map<string, ExperienceMedia[]>> {
        const { experienceIds, state, tx } = input;
        const grouped = new Map<string, ExperienceMedia[]>();
        if (experienceIds.length === 0) return grouped;

        const db = this.getClient(tx);
        const logContext = { count: experienceIds.length, state };

        try {
            const conditions = [
                inArray(experienceMedia.experienceId, [...experienceIds]),
                isNull(experienceMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(experienceMedia.state, state));
            }

            // Secondary sort by `id` guarantees a deterministic order even when two
            // rows of the same listing share a `sort_order` value (should not happen
            // by design, but keeps the composed gallery order stable regardless).
            const rows = (await db
                .select()
                .from(experienceMedia)
                .where(and(...conditions))
                .orderBy(
                    asc(experienceMedia.sortOrder),
                    asc(experienceMedia.id)
                )) as ExperienceMedia[];

            for (const row of rows) {
                const list = grouped.get(row.experienceId);
                if (list) {
                    list.push(row);
                } else {
                    grouped.set(row.experienceId, [row]);
                }
            }
            try {
                logQuery(this.entityName, 'findByExperiences', logContext, {
                    experiences: grouped.size,
                    rows: rows.length
                });
            } catch {}
            return grouped;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByExperiences', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByExperiences', logContext, err.message);
        }
    }
}

/**
 * Singleton instance of `ExperienceMediaModel`.
 *
 * Use this exported constant across the application instead of constructing a new
 * instance. The underlying Drizzle client is resolved lazily via `getDb()` on each
 * operation, so the singleton is safe to import at module load time.
 */
export const experienceMediaModel = new ExperienceMediaModel();
