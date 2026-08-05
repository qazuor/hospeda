import type { EventMedia } from '@repo/schemas';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { eventMedia } from '../../schemas/event/event_media.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input type for `findByEvent` — groups optional filters into a single
 * RO-RO parameter object (Receive Object, Return Object pattern).
 */
interface FindByEventInput {
    /** The event UUID to load media for. */
    eventId: string;
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
    /** The event UUID whose featured image is requested. */
    eventId: string;
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Input type for `findByEvents` (batch read).
 */
interface FindByEventsInput {
    /** The event UUIDs to load media for (one query, grouped by id). */
    eventIds: readonly string[];
    /**
     * Optional state filter ('visible' | 'archived'). Omit to return all states.
     */
    state?: 'visible' | 'archived';
    /** Optional transaction client. */
    tx?: DrizzleClient;
}

/**
 * Model for event media (gallery photos).
 *
 * Provides the canonical query surface for reading the `event_media` table.
 * All write operations (create, update, soft-delete, restore) are inherited from
 * `BaseModelImpl` — do not re-implement them here.
 *
 * Key points for callers:
 * - Every finder excludes soft-deleted rows (`deletedAt IS NULL`) by default.
 * - Gallery ordering is by `sort_order ASC` (not insertion time).
 * - The singleton `eventMediaModel` should be used instead of instantiating
 *   this class directly, unless a custom Drizzle client is required.
 *
 * @see packages/db/src/schemas/event/event_media.dbschema.ts — schema +
 *   column docs (D1/D2/D3 decisions).
 * @see packages/db/src/migrations/extras/ — T-003 partial-unique index on `is_featured`
 *   and CHECK constraint enforcing `is_featured ⇒ NOT archived`.
 */
export class EventMediaModel extends BaseModelImpl<EventMedia> {
    protected table = eventMedia;
    public entityName = 'eventMedia';

    /** Drizzle relational query key — must match the table export name. */
    protected getTableName(): string {
        return 'eventMedia';
    }

    /**
     * Returns the registered relation keys so `findOneWithRelations` /
     * `findAllWithRelations` can warn on unknown keys.
     */
    protected override readonly validRelationKeys = ['event'] as const;

    // -------------------------------------------------------------------------
    // Event-media-specific finders
    // -------------------------------------------------------------------------

    /**
     * Lists all non-deleted media rows for a given event, ordered by
     * `sort_order ASC`.
     *
     * This is the canonical gallery-read query used by public and admin consumers.
     * Pass `state: 'visible'` to get the active gallery, `state: 'archived'` to
     * get archived photos, or omit `state` to return all.
     *
     * Pagination is mandatory (inherited `BaseModelImpl.findAll` cap applies — max
     * 200 rows per page). For a event that has never exceeded ~200 photos
     * the default `pageSize: 50` is sufficient for a single-page load.
     *
     * @param input.eventId - UUID of the parent event.
     * @param input.state           - Optional state filter ('visible' | 'archived').
     * @param input.page            - 1-based page number (default 1).
     * @param input.pageSize        - Rows per page (default 50, max 200 via BaseModel).
     * @param input.tx              - Optional transaction client.
     * @returns Paginated list of media rows + total count.
     */
    async findByEvent(input: FindByEventInput): Promise<{ items: EventMedia[]; total: number }> {
        const { eventId, state, page = 1, pageSize = 50, tx } = input;
        const db = this.getClient(tx);
        const logContext = { eventId, state, page, pageSize };

        try {
            const conditions = [eq(eventMedia.eventId, eventId), isNull(eventMedia.deletedAt)];
            if (state !== undefined) {
                conditions.push(eq(eventMedia.state, state));
            }

            const whereClause = and(...conditions);
            const offset = (page - 1) * pageSize;

            const [items, countResult] = await Promise.all([
                db
                    .select()
                    .from(eventMedia)
                    .where(whereClause)
                    .orderBy(asc(eventMedia.sortOrder))
                    .limit(pageSize)
                    .offset(offset),
                db.select({ count: count() }).from(eventMedia).where(whereClause)
            ]);

            const result = {
                items: items as EventMedia[],
                total: Number(countResult[0]?.count ?? 0)
            };
            try {
                logQuery(this.entityName, 'findByEvent', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByEvent', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByEvent', logContext, err.message);
        }
    }

    /**
     * Returns the featured image row for a given event, or `null` when none exists.
     *
     * At most one non-deleted row can have `is_featured = true` per event — the
     * partial unique index (the extras carril) enforces this at the DB level. This finder
     * intentionally does NOT use a LIMIT hint beyond what the index guarantees.
     *
     * @param input.eventId - UUID of the parent event.
     * @param input.tx              - Optional transaction client.
     * @returns The featured media row, or `null` if no featured image is set.
     */
    async findFeatured(input: FindFeaturedInput): Promise<EventMedia | null> {
        const { eventId, tx } = input;
        const db = this.getClient(tx);
        const logContext = { eventId };

        try {
            const result = await db
                .select()
                .from(eventMedia)
                .where(
                    and(
                        eq(eventMedia.eventId, eventId),
                        eq(eventMedia.isFeatured, true),
                        isNull(eventMedia.deletedAt)
                    )
                )
                .limit(1);

            const row = (result[0] as EventMedia) ?? null;
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
     * Batch-loads non-deleted media rows for multiple events in a single
     * query, grouped by `eventId`. This is the canonical read used by
     * list/search composition (HOS-390) to avoid the N+1 that would result
     * from calling {@link findByEvent} once per list item.
     *
     * Rows are returned ordered by `sort_order ASC` within each event's
     * array (the SQL `ORDER BY` is global, but `sort_order` is the only ordering
     * key and grouping preserves it). Events with no media are simply
     * absent from the returned map — callers should default to `[]`.
     *
     * Unlike {@link findByEvent} this finder is intentionally NOT paginated:
     * it loads the full media set for the given ids so composition is complete. A
     * single list page of events × their galleries stays well within a
     * reasonable row budget.
     *
     * @param input.eventIds - UUIDs to load (empty array → empty map, no query).
     * @param input.state            - Optional state filter ('visible' | 'archived').
     * @param input.tx               - Optional transaction client.
     * @returns Map of eventId → ordered media rows.
     */
    async findByEvents(input: FindByEventsInput): Promise<Map<string, EventMedia[]>> {
        const { eventIds, state, tx } = input;
        const grouped = new Map<string, EventMedia[]>();
        if (eventIds.length === 0) return grouped;

        const db = this.getClient(tx);
        const logContext = { count: eventIds.length, state };

        try {
            const conditions = [
                inArray(eventMedia.eventId, [...eventIds]),
                isNull(eventMedia.deletedAt)
            ];
            if (state !== undefined) {
                conditions.push(eq(eventMedia.state, state));
            }

            // Secondary sort by `id` guarantees a deterministic order even when two
            // rows of the same event share a `sort_order` value (should not
            // happen by design, but keeps the composed gallery order stable regardless).
            const rows = (await db
                .select()
                .from(eventMedia)
                .where(and(...conditions))
                .orderBy(asc(eventMedia.sortOrder), asc(eventMedia.id))) as EventMedia[];

            for (const row of rows) {
                const list = grouped.get(row.eventId);
                if (list) {
                    list.push(row);
                } else {
                    grouped.set(row.eventId, [row]);
                }
            }
            try {
                logQuery(this.entityName, 'findByEvents', logContext, {
                    events: grouped.size,
                    rows: rows.length
                });
            } catch {}
            return grouped;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByEvents', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByEvents', logContext, err.message);
        }
    }
}

/**
 * Singleton instance of `EventMediaModel`.
 *
 * Use this exported constant across the application instead of constructing a new
 * instance. The underlying Drizzle client is resolved lazily via `getDb()` on each
 * operation, so the singleton is safe to import at module load time.
 */
export const eventMediaModel = new EventMediaModel();
