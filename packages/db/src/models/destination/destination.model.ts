import type { Destination, DestinationType, DestinationWithAttractionNames } from '@repo/schemas';
import {
    type AnyColumn,
    type SQL,
    and,
    asc,
    count,
    desc,
    eq,
    inArray,
    isNull,
    like,
    lte,
    or,
    sql
} from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { attractions } from '../../schemas/destination/attraction.dbschema.ts';
import { destinations } from '../../schemas/destination/destination.dbschema.ts';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause, safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Synthetic sort field name that orders destinations by the number of active
 * (non-deleted) bookmarks pointing at them. Implemented as a correlated
 * subquery against `user_bookmarks` filtered by `entity_type = 'DESTINATION'`
 * and `deleted_at IS NULL`. SPEC-098 T-052c (mirrors the accommodation/event
 * implementations from T-052/T-052a).
 *
 * Performance depends on the compound index `idx_user_bookmarks_entity_active`
 * on `(entity_id, entity_type, deleted_at)` (see SPEC-098 T-008 and the
 * `0019_user_bookmarks_entity_active_index.sql` manual migration).
 */
const MOST_SAVED_SORT_FIELD = 'mostSaved';

/**
 * Build the correlated subquery used as the ORDER BY expression for the
 * `mostSaved` synthetic sort. NULL counts (i.e. no active bookmarks) are
 * folded to zero by `COUNT(*)`, so no `NULLS LAST` clause is required.
 */
function buildMostSavedOrderExpr(order: 'asc' | 'desc'): SQL {
    const direction = order === 'desc' ? sql`DESC` : sql`ASC`;
    return sql`(
        SELECT COUNT(*) FROM ${userBookmarks}
        WHERE ${userBookmarks.entityId} = ${destinations.id}
          AND ${userBookmarks.entityType} = 'DESTINATION'
          AND ${userBookmarks.deletedAt} IS NULL
    ) ${direction}`;
}

export class DestinationModel extends BaseModelImpl<Destination> {
    protected table = destinations;
    public entityName = 'destinations';

    protected override readonly validRelationKeys = [
        'parent',
        'children',
        'accommodations',
        'reviews',
        'tags',
        'attractions',
        'faqs',
        'createdBy',
        'updatedBy',
        'deletedBy'
    ] as const;

    /**
     * The `media` column stores structured image metadata as JSONB.
     * Opting in here ensures that a partial media patch does not overwrite
     * sibling keys written by a concurrent request (GAP-078-186, GAP-078-198).
     */
    protected override readonly mergeableJsonbColumns = ['media'] as const;

    protected getTableName(): string {
        return 'destinations';
    }

    /**
     * Overrides {@link BaseModelImpl.findAll} to:
     *
     * 1. Support the synthetic `mostSaved` sort field. When
     *    `options.sortBy === 'mostSaved'`, the query orders rows by the count of
     *    active bookmarks via a correlated subquery on `user_bookmarks`
     *    (entity_type='DESTINATION' AND deleted_at IS NULL), with a stable
     *    `id DESC` tiebreaker so pagination stays deterministic.
     *    SPEC-098 T-052c — mirrors the accommodation/event `mostSaved` mechanism.
     *
     * 2. Apply a destination-specific default ordering when no explicit `sortBy`
     *    is provided: featured destinations first (`is_featured DESC`), then
     *    alphabetical by name (case-insensitive). This makes every consumer of
     *    the destinations list — public listings, hero search picker, accommodation
     *    create form selector, admin tables — share the same baseline order
     *    without each call site having to re-sort client-side.
     *
     * All other explicit sort fields delegate to the base implementation unchanged.
     */
    override async findAll(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
        additionalConditions?: SQL[],
        tx?: DrizzleClient
    ): Promise<{ items: Destination[]; total: number }> {
        if (options?.sortBy && options.sortBy !== MOST_SAVED_SORT_FIELD) {
            return super.findAll(where, options, additionalConditions, tx);
        }

        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 10;
        const isMostSaved = options?.sortBy === MOST_SAVED_SORT_FIELD;
        const sortOrder: 'asc' | 'desc' = options?.sortOrder ?? (isMostSaved ? 'desc' : 'asc');
        const offset = (page - 1) * pageSize;

        const logContext = {
            where: safeWhere,
            page,
            pageSize,
            sortBy: options?.sortBy ?? 'default'
        };

        try {
            const baseWhereClause = buildWhereClause(safeWhere, this.table);

            const allConditions: SQL[] = [];
            if (baseWhereClause) allConditions.push(baseWhereClause);
            if (additionalConditions && additionalConditions.length > 0) {
                allConditions.push(...additionalConditions);
            }

            const finalWhereClause =
                allConditions.length === 0
                    ? undefined
                    : allConditions.length === 1
                      ? allConditions[0]
                      : and(...allConditions);

            // Default: featured first, then alphabetical by name (case-insensitive).
            // `mostSaved`: bookmark-count subquery + stable `id DESC` tiebreaker.
            const orderByExprs: SQL[] = isMostSaved
                ? [buildMostSavedOrderExpr(sortOrder), desc(destinations.id)]
                : [desc(destinations.isFeatured), sql`LOWER(${destinations.name}) ASC`];

            const itemsQuery = db
                .select()
                .from(this.table)
                .where(finalWhereClause)
                .orderBy(...orderByExprs)
                .limit(pageSize)
                .offset(offset);

            const [items, total] = await Promise.all([
                itemsQuery,
                this.count(safeWhere, { additionalConditions, tx })
            ]);

            // DRIZZLE-LIMITATION: relational query result widens nullable JSONB columns vs the entity type; the projection above already returns the canonical shape.
            const result = { items: items as unknown as Destination[], total };
            try {
                logQuery(this.entityName, 'findAll', logContext, result);
            } catch {}
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAll', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findAll', logContext, err.message);
        }
    }

    /**
     * Finds a destination with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodations: true })
     * @returns Promise resolving to the destination with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Destination | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            // Dynamically build the 'with' object
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'accommodations',
                'reviews',
                'tags',
                'attractions',
                'faqs',
                'createdBy',
                'updatedBy',
                'deletedBy'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                // Build the final `with` config: if `faqs` was requested, apply
                // display_order ASC NULLS LAST, created_at ASC ordering (SPEC-177 T-012).
                // biome-ignore lint/suspicious/noExplicitAny: Drizzle relational orderBy callback fields type is inferred at runtime; we use `any` solely for the config object shape
                const withConfig: Record<string, any> = { ...withObj };
                if (withObj.faqs) {
                    withConfig.faqs = {
                        where: (
                            fields: { deletedAt: AnyColumn },
                            { isNull }: { isNull: (col: AnyColumn) => unknown }
                        ) => isNull(fields.deletedAt),
                        orderBy: (fields: { displayOrder: AnyColumn; createdAt: AnyColumn }) => [
                            sql`${fields.displayOrder} ASC NULLS LAST`,
                            asc(fields.createdAt)
                        ]
                    };
                }
                const result = await db.query.destinations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withConfig
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                // DRIZZLE-LIMITATION: findFirst with `with: { ...destination relations, audit users }` returns Drizzle's nested join shape; Destination entity uses domain-mapped relations and unbranded enum types.
                return result as unknown as Destination | null;
            }
            // Fallback to base findOne if there are no relations
            const result = await this.findOne(where, tx);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findWithRelations', { where, relations }, error as Error);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                (error as Error).message
            );
        }
    }

    /**
     * Finds all destinations related to a given attraction by attractionId.
     * Performs a join between destinations and r_destination_attraction to find
     * all destinations that are linked to the specified attraction.
     *
     * @param attractionId - The ID of the attraction to filter by
     * @param tx - Optional transaction client
     * @returns Promise resolving to an array of Destination
     * @throws DbError if the database query fails
     */
    async findAllByAttractionId(attractionId: string, tx?: DrizzleClient): Promise<Destination[]> {
        const db = this.getClient(tx);
        try {
            const results = await db
                .select({ destination: destinations })
                .from(destinations)
                .innerJoin(
                    rDestinationAttraction,
                    eq(rDestinationAttraction.destinationId, destinations.id)
                )
                .where(eq(rDestinationAttraction.attractionId, attractionId));
            const mapped = results.map((r) => r.destination);
            logQuery(this.entityName, 'findAllByAttractionId', { attractionId }, mapped);
            return mapped as Destination[];
        } catch (error) {
            logError(this.entityName, 'findAllByAttractionId', { attractionId }, error as Error);
            throw new DbError(
                this.entityName,
                'findAllByAttractionId',
                { attractionId },
                (error as Error).message
            );
        }
    }

    /**
     * Searches for destinations with attractions populated for list display.
     * @param params - Search parameters (filters, sort, pagination)
     * @returns Promise resolving to an object with items (including attraction names) and total count
     */
    async searchWithAttractions(
        params: {
            filters?: Record<string, unknown>;
            orderBy?: Record<string, 'asc' | 'desc'>;
            page?: number;
            pageSize?: number;
        },
        tx?: DrizzleClient
    ): Promise<{ items: DestinationWithAttractionNames[]; total: number }> {
        const db = this.getClient(tx);
        const { filters = {}, orderBy = { name: 'asc' }, page = 1, pageSize = 20 } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchClauses = [safeIlike(destinations.name, filters.q)].filter(
                    (clause): clause is SQL<unknown> => clause !== undefined
                );

                if (searchClauses.length > 0) {
                    const orClause = or(...searchClauses);
                    if (orClause) {
                        whereClauses.push(orClause);
                    }
                }
            }

            // Handle other filters (simple equality)
            for (const [key, value] of Object.entries(filters).filter(([key]) => key !== 'q')) {
                const column = destinations[key as keyof typeof destinations];
                if (
                    value !== undefined &&
                    value !== null &&
                    column &&
                    typeof column === 'object' &&
                    'name' in column
                ) {
                    whereClauses.push(eq(column as AnyColumn, value));
                }
            }

            const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

            // Build order array using Drizzle's asc/desc
            const orderArr = Object.entries(orderBy).map(([field, dir]) => {
                const column = destinations[field as keyof typeof destinations] as AnyColumn;
                return dir === 'asc' ? asc(column) : desc(column);
            });

            const offset = (page - 1) * pageSize;

            // Get destinations first
            const destinationItems = await db
                .select()
                .from(destinations)
                .where(where)
                .orderBy(...orderArr)
                .limit(pageSize)
                .offset(offset);

            // Get attraction names for each destination
            const destinationsWithAttractions = await Promise.all(
                destinationItems.map(async (destination) => {
                    const attractionResults = await db
                        .select({ name: attractions.name })
                        .from(rDestinationAttraction)
                        .innerJoin(
                            attractions,
                            eq(rDestinationAttraction.attractionId, attractions.id)
                        )
                        .where(eq(rDestinationAttraction.destinationId, destination.id))
                        .orderBy(desc(attractions.displayWeight));

                    return {
                        ...destination,
                        attractionNames: attractionResults.map((a) => a.name)
                    };
                })
            );

            const totalResult = await db.select({ count: count() }).from(destinations).where(where);
            return {
                items: destinationsWithAttractions as DestinationWithAttractionNames[],
                total: Number(totalResult[0]?.count ?? 0)
            };
        } catch (error) {
            logError(this.entityName, 'searchWithAttractions', params, error as Error);
            throw new DbError(
                this.entityName,
                'searchWithAttractions',
                params,
                (error as Error).message
            );
        }
    }

    /**
     * Batch-loads attractions for a set of destination IDs in a single query.
     * @param destIds - Array of destination UUIDs
     * @returns Map of destinationId to array of { id, name, icon } attraction objects
     */
    async getAttractionsMap(
        destIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<
        Map<
            string,
            Array<{
                readonly id: string;
                readonly name: string;
                readonly icon: string | null;
                readonly displayWeight: number;
            }>
        >
    > {
        if (destIds.length === 0) return new Map();
        const db = this.getClient(tx);
        try {
            const results = await db
                .select({
                    destinationId: rDestinationAttraction.destinationId,
                    id: attractions.id,
                    name: attractions.name,
                    icon: attractions.icon,
                    displayWeight: attractions.displayWeight
                })
                .from(rDestinationAttraction)
                .innerJoin(attractions, eq(rDestinationAttraction.attractionId, attractions.id))
                .where(inArray(rDestinationAttraction.destinationId, [...destIds]))
                .orderBy(desc(attractions.displayWeight));

            const map = new Map<
                string,
                Array<{
                    readonly id: string;
                    readonly name: string;
                    readonly icon: string | null;
                    readonly displayWeight: number;
                }>
            >();
            for (const row of results) {
                const existing = map.get(row.destinationId) ?? [];
                existing.push({
                    id: row.id,
                    name: row.name,
                    icon: row.icon,
                    displayWeight: row.displayWeight
                });
                map.set(row.destinationId, existing);
            }
            return map;
        } catch (error) {
            logError(this.entityName, 'getAttractionsMap', { destIds }, error as Error);
            throw new DbError(
                this.entityName,
                'getAttractionsMap',
                { destIds },
                (error as Error).message
            );
        }
    }

    /**
     * Searches for destinations with optional filters, sorting, and pagination.
     * @param params - Search parameters (filters, sort, pagination)
     * @returns Promise resolving to an object with items and total count
     */
    async search(
        params: {
            filters?: Record<string, unknown>;
            orderBy?: Record<string, 'asc' | 'desc'>;
            page?: number;
            pageSize?: number;
        },
        tx?: DrizzleClient
    ): Promise<{ items: Destination[]; total: number }> {
        const db = this.getClient(tx);
        const { filters = {}, orderBy = { name: 'asc' }, page = 1, pageSize = 20 } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchClauses = [safeIlike(destinations.name, filters.q)].filter(
                    (clause): clause is SQL<unknown> => clause !== undefined
                );

                if (searchClauses.length > 0) {
                    const orClause = or(...searchClauses);
                    if (orClause) {
                        whereClauses.push(orClause);
                    }
                }
            }

            // Handle other filters (simple equality)
            for (const [key, value] of Object.entries(filters).filter(([key]) => key !== 'q')) {
                const column = destinations[key as keyof typeof destinations];
                if (
                    value !== undefined &&
                    value !== null &&
                    column &&
                    typeof column === 'object' &&
                    'name' in column
                ) {
                    whereClauses.push(eq(column as AnyColumn, value));
                }
            }

            const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

            // Build order array using Drizzle's asc/desc
            const orderArr = Object.entries(orderBy).map(([field, dir]) => {
                const column = destinations[field as keyof typeof destinations] as AnyColumn;
                return dir === 'asc' ? asc(column) : desc(column);
            });

            const offset = (page - 1) * pageSize;
            const items = await db
                .select()
                .from(destinations)
                .where(where)
                .orderBy(...orderArr)
                .limit(pageSize)
                .offset(offset);
            const totalResult = await db.select({ count: count() }).from(destinations).where(where);
            return { items: items as Destination[], total: Number(totalResult[0]?.count ?? 0) };
        } catch (error) {
            logError(this.entityName, 'search', params, error as Error);
            throw new DbError(this.entityName, 'search', params, (error as Error).message);
        }
    }

    // ========================================================================
    // HIERARCHY METHODS
    // ========================================================================

    /**
     * Finds direct children of a destination (one level below).
     * @param parentId - The ID of the parent destination
     * @returns Promise resolving to an array of child destinations
     */
    async findChildren(parentId: string, tx?: DrizzleClient): Promise<Destination[]> {
        const db = this.getClient(tx);
        try {
            const results = await db
                .select()
                .from(destinations)
                .where(
                    and(
                        eq(destinations.parentDestinationId, parentId),
                        isNull(destinations.deletedAt)
                    )
                )
                .orderBy(asc(destinations.level), asc(destinations.name));
            logQuery(this.entityName, 'findChildren', { parentId }, results);
            return results as Destination[];
        } catch (error) {
            logError(this.entityName, 'findChildren', { parentId }, error as Error);
            throw new DbError(
                this.entityName,
                'findChildren',
                { parentId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds all descendants of a destination using materialized pathIds.
     * @param destinationId - The ID of the ancestor destination
     * @param options - Optional filters: maxDepth (1-10), destinationType
     * @returns Promise resolving to an array of descendant destinations ordered by level
     */
    async findDescendants(
        destinationId: string,
        options?: { maxDepth?: number; destinationType?: DestinationType },
        tx?: DrizzleClient
    ): Promise<Destination[]> {
        const db = this.getClient(tx);
        try {
            const parent = await this.findOne({ id: destinationId }, tx);
            if (!parent) {
                return [];
            }

            const descendantPathPrefix = parent.pathIds
                ? `${parent.pathIds}/${parent.id}`
                : parent.id;

            const whereClauses: SQL<unknown>[] = [
                like(destinations.pathIds, `${descendantPathPrefix}%`),
                isNull(destinations.deletedAt)
            ];

            if (options?.maxDepth !== undefined) {
                whereClauses.push(lte(destinations.level, parent.level + options.maxDepth));
            }

            if (options?.destinationType) {
                whereClauses.push(eq(destinations.destinationType, options.destinationType));
            }

            const results = await db
                .select()
                .from(destinations)
                .where(and(...whereClauses))
                .orderBy(asc(destinations.level), asc(destinations.name));

            logQuery(this.entityName, 'findDescendants', { destinationId, options }, results);
            return results as Destination[];
        } catch (error) {
            logError(
                this.entityName,
                'findDescendants',
                { destinationId, options },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'findDescendants',
                { destinationId, options },
                (error as Error).message
            );
        }
    }

    /**
     * Finds all ancestors of a destination using pathIds.
     * Returns ancestors ordered from root (level 0) to immediate parent.
     * @param destinationId - The ID of the destination
     * @returns Promise resolving to an array of ancestor destinations
     */
    async findAncestors(destinationId: string, tx?: DrizzleClient): Promise<Destination[]> {
        const db = this.getClient(tx);
        try {
            const destination = await this.findOne({ id: destinationId }, tx);
            if (!destination || !destination.pathIds) {
                return [];
            }

            const ancestorIds = destination.pathIds.split('/').filter(Boolean);
            if (ancestorIds.length === 0) {
                return [];
            }

            const results = await db
                .select()
                .from(destinations)
                .where(and(inArray(destinations.id, ancestorIds), isNull(destinations.deletedAt)))
                .orderBy(asc(destinations.level));

            logQuery(this.entityName, 'findAncestors', { destinationId }, results);
            return results as Destination[];
        } catch (error) {
            logError(this.entityName, 'findAncestors', { destinationId }, error as Error);
            throw new DbError(
                this.entityName,
                'findAncestors',
                { destinationId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds a destination by its materialized path.
     * @param path - The materialized path (e.g., '/argentina/entre-rios/concepcion-del-uruguay')
     * @returns Promise resolving to the destination or null
     */
    async findByPath(path: string, tx?: DrizzleClient): Promise<Destination | null> {
        const db = this.getClient(tx);
        try {
            const results = await db
                .select()
                .from(destinations)
                .where(and(eq(destinations.path, path), isNull(destinations.deletedAt)))
                .limit(1);

            const result = results[0] ?? null;
            logQuery(this.entityName, 'findByPath', { path }, result);
            return result as Destination | null;
        } catch (error) {
            logError(this.entityName, 'findByPath', { path }, error as Error);
            throw new DbError(this.entityName, 'findByPath', { path }, (error as Error).message);
        }
    }

    /**
     * Checks if a destination is a descendant of another destination.
     * Used for cycle detection during reparenting.
     * @param potentialDescendantId - ID of the potential descendant
     * @param ancestorId - ID of the potential ancestor
     * @returns Promise resolving to true if it is a descendant
     */
    async isDescendant(
        potentialDescendantId: string,
        ancestorId: string,
        tx?: DrizzleClient
    ): Promise<boolean> {
        try {
            const descendant = await this.findOne({ id: potentialDescendantId }, tx);
            if (!descendant || !descendant.pathIds) {
                return false;
            }
            const ancestorIds = descendant.pathIds.split('/').filter(Boolean);
            return ancestorIds.includes(ancestorId);
        } catch (error) {
            logError(
                this.entityName,
                'isDescendant',
                { potentialDescendantId, ancestorId },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'isDescendant',
                { potentialDescendantId, ancestorId },
                (error as Error).message
            );
        }
    }

    /**
     * Updates the path of all descendants when a destination is reparented or its slug changes.
     * Uses a single batch UPDATE with SQL REPLACE to atomically update all descendant paths.
     * @param parentId - The ID of the parent whose descendants need updating
     * @param oldPath - The old path prefix to replace
     * @param newPath - The new path prefix
     * @param tx - Optional transaction client for transactional consistency
     */
    async updateDescendantPaths(
        parentId: string,
        oldPath: string,
        newPath: string,
        tx?: DrizzleClient
    ): Promise<void> {
        const db = this.getClient(tx);
        try {
            // Single batch UPDATE: replace the old path prefix with the new one
            // for all descendants whose path starts with the old path followed by '/'
            const oldPrefix = `${oldPath}/`;
            const newPrefix = `${newPath}/`;

            await db.execute(
                sql`UPDATE destinations
                    SET path = ${newPrefix} || SUBSTRING(path FROM ${oldPrefix.length + 1}),
                        updated_at = NOW()
                    WHERE path LIKE ${`${oldPrefix}%`}`
            );

            logQuery(
                this.entityName,
                'updateDescendantPaths',
                { parentId, oldPath, newPath },
                null
            );
        } catch (error) {
            logError(
                this.entityName,
                'updateDescendantPaths',
                { parentId, oldPath, newPath },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'updateDescendantPaths',
                { parentId, oldPath, newPath },
                (error as Error).message
            );
        }
    }

    // ========================================================================
    // SEARCH AND COUNT METHODS
    // ========================================================================

    /**
     * Counts destinations matching the provided filters.
     * @param params - Object with filters
     * @returns Promise resolving to an object with the count
     */
    async countByFilters(
        params: { filters?: Record<string, unknown> },
        tx?: DrizzleClient
    ): Promise<{
        count: number;
    }> {
        const db = this.getClient(tx);
        const { filters = {} } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchClauses = [safeIlike(destinations.name, filters.q)].filter(
                    (clause): clause is SQL<unknown> => clause !== undefined
                );

                if (searchClauses.length > 0) {
                    const orClause = or(...searchClauses);
                    if (orClause) {
                        whereClauses.push(orClause);
                    }
                }
            }

            // Handle other filters (simple equality)
            for (const [key, value] of Object.entries(filters).filter(([key]) => key !== 'q')) {
                const column = destinations[key as keyof typeof destinations];
                if (
                    value !== undefined &&
                    value !== null &&
                    column &&
                    typeof column === 'object' &&
                    'name' in column
                ) {
                    whereClauses.push(eq(column as AnyColumn, value));
                }
            }

            const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;
            const totalResult = await db.select({ count: count() }).from(destinations).where(where);
            return { count: Number(totalResult[0]?.count ?? 0) };
        } catch (error) {
            logError(this.entityName, 'countByFilters', params, error as Error);
            throw new DbError(this.entityName, 'countByFilters', params, (error as Error).message);
        }
    }
}

/** Singleton instance of DestinationModel for use across the application. */
export const destinationModel = new DestinationModel();
