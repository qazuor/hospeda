import type { Destination, DestinationType, DestinationWithAttractionNames } from '@repo/schemas';
import {
    type AnyColumn,
    type SQL,
    and,
    asc,
    count,
    desc,
    eq,
    ilike,
    inArray,
    isNull,
    like,
    lte,
    or,
    sql
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model.ts';
import { getDb, type schema } from '../../client.ts';
import { attractions } from '../../schemas/destination/attraction.dbschema.ts';
import { destinations } from '../../schemas/destination/destination.dbschema.ts';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class DestinationModel extends BaseModel<Destination> {
    protected table = destinations;
    protected entityName = 'destinations';

    protected getTableName(): string {
        return 'destinations';
    }

    /**
     * Finds a destination with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodations: true })
     * @returns Promise resolving to the destination with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<Destination | null> {
        const db = getDb();
        try {
            // Dynamically build the 'with' object
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'accommodations',
                'reviews',
                'tags',
                'attractions',
                'createdBy',
                'updatedBy',
                'deletedBy'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.destinations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as Destination | null;
            }
            // Fallback to base findOne if there are no relations
            const result = await this.findOne(where);
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
     * Performs a join between destinations and r_destination_attraction.
     *
     * @param attractionId - The ID of the attraction to filter by
     * @returns Promise resolving to an array of DestinationType
     * @throws DbError if the database query fails
     */
    async findAllByAttractionId(attractionId: string): Promise<Destination[]> {
        const db = getDb();
        try {
            const results = await db.query.destinations.findMany({
                where: (fields, { eq }) => eq(fields.id, attractionId),
                with: { attractions: true }
            });
            logQuery(this.entityName, 'findAllByAttractionId', { attractionId }, results);
            return results as unknown as Destination[];
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
    async searchWithAttractions(params: {
        filters?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: DestinationWithAttractionNames[]; total: number }> {
        const db = getDb();
        const { filters = {}, orderBy = { name: 'asc' }, page = 1, pageSize = 20 } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchTerm = `%${filters.q}%`;
                const searchClauses = [ilike(destinations.name, searchTerm)].filter(
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
                total: totalResult[0]?.count ?? 0
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
    async getAttractionsMap(destIds: readonly string[]): Promise<
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
        const db = getDb();
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
    async search(params: {
        filters?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
        page?: number;
        pageSize?: number;
    }): Promise<{ items: Destination[]; total: number }> {
        const db = getDb();
        const { filters = {}, orderBy = { name: 'asc' }, page = 1, pageSize = 20 } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchTerm = `%${filters.q}%`;
                const searchClauses = [ilike(destinations.name, searchTerm)].filter(
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
            return { items: items as Destination[], total: totalResult[0]?.count ?? 0 };
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
    async findChildren(parentId: string): Promise<Destination[]> {
        const db = getDb();
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
        options?: { maxDepth?: number; destinationType?: DestinationType }
    ): Promise<Destination[]> {
        const db = getDb();
        try {
            const parent = await this.findOne({ id: destinationId });
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
    async findAncestors(destinationId: string): Promise<Destination[]> {
        const db = getDb();
        try {
            const destination = await this.findOne({ id: destinationId });
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
    async findByPath(path: string): Promise<Destination | null> {
        const db = getDb();
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
    async isDescendant(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
        try {
            const descendant = await this.findOne({ id: potentialDescendantId });
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
        tx?: NodePgDatabase<typeof schema>
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
    async countByFilters(params: { filters?: Record<string, unknown> }): Promise<{
        count: number;
    }> {
        const db = getDb();
        const { filters = {} } = params;
        try {
            // Build Drizzle where clause from filters
            const whereClauses: SQL<unknown>[] = [];

            // Handle text search parameter 'q'
            if (filters.q && typeof filters.q === 'string') {
                const searchTerm = `%${filters.q}%`;
                const searchClauses = [ilike(destinations.name, searchTerm)].filter(
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
            return { count: totalResult[0]?.count ?? 0 };
        } catch (error) {
            logError(this.entityName, 'countByFilters', params, error as Error);
            throw new DbError(this.entityName, 'countByFilters', params, (error as Error).message);
        }
    }
}
