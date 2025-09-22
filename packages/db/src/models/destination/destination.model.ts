import type { Destination, DestinationWithAttractionNames } from '@repo/schemas';
import { type SQL, and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { attractions } from '../../schemas/destination/attraction.dbschema';
import { destinations } from '../../schemas/destination/destination.dbschema';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class DestinationModel extends BaseModel<Destination> {
    protected table = destinations;
    protected entityName = 'destinations';

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
                return result as Destination | null;
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
                where: (fields, { eq }) => eq(fields.attractions.attractionId, attractionId),
                with: { attractions: true }
            });
            logQuery(this.entityName, 'findAllByAttractionId', { attractionId }, results);
            return results as Destination[];
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
                if (value !== undefined && value !== null && destinations[key]) {
                    whereClauses.push(eq(destinations[key], value));
                }
            }

            const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

            // Build order array using Drizzle's asc/desc
            const orderArr = Object.entries(orderBy).map(([field, dir]) =>
                dir === 'asc' ? asc(destinations[field]) : desc(destinations[field])
            );

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
                        .where(eq(rDestinationAttraction.destinationId, destination.id));

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
                if (value !== undefined && value !== null && destinations[key]) {
                    whereClauses.push(eq(destinations[key], value));
                }
            }

            const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

            // Build order array using Drizzle's asc/desc
            const orderArr = Object.entries(orderBy).map(([field, dir]) =>
                dir === 'asc' ? asc(destinations[field]) : desc(destinations[field])
            );

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
                if (value !== undefined && value !== null && destinations[key]) {
                    whereClauses.push(eq(destinations[key], value));
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
