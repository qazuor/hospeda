import type {
    Accommodation,
    AccommodationRatingInput,
    AccommodationSearchInput,
    DestinationSummary,
    UserSummary
} from '@repo/schemas';
import type { AnyColumn, SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';

export class AccommodationModel extends BaseModel<Accommodation> {
    protected table = accommodations;
    protected entityName = 'accommodations';

    protected getTableName(): string {
        return 'accommodations';
    }

    public async countByFilters(
        params: AccommodationSearchInput & { excludeRestricted?: boolean }
    ): Promise<{ count: number }> {
        const db = getDb();

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: totalResult[0]?.count ?? 0 };
    }

    public async search(
        params: AccommodationSearchInput & { excludeRestricted?: boolean }
    ): Promise<{ items: Accommodation[]; total: number }> {
        const db = getDb();

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        // Note: Filtering by amenities would require a join and is more complex.
        // This is a simplified example.

        const where = and(...whereClauses);

        const orderBy = [];
        if (params.sortBy) {
            const column = accommodations[params.sortBy as keyof typeof accommodations];
            if (column && typeof column === 'object' && 'name' in column) {
                orderBy.push(
                    params.sortOrder === 'desc'
                        ? desc(column as AnyColumn)
                        : asc(column as AnyColumn)
                );
            }
        }

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        const resultsQuery = db
            .select()
            .from(this.table)
            .where(where)
            .orderBy(...orderBy)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);

        const [items, totalResult] = await Promise.all([resultsQuery, totalQuery]);
        const total = totalResult[0]?.count ?? 0;

        return { items: items as unknown as Accommodation[], total };
    }

    /**
     * Search accommodations with destination and owner relations
     */
    public async searchWithRelations(
        params: AccommodationSearchInput & { excludeRestricted?: boolean }
    ): Promise<{
        items: Array<
            Accommodation & {
                destination?: DestinationSummary;
                owner?: UserSummary;
            }
        >;
        total: number;
    }> {
        const db = getDb();

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }

        const where = and(...whereClauses);

        const orderBy = [];
        if (params.sortBy) {
            const column = accommodations[params.sortBy as keyof typeof accommodations];
            if (column && typeof column === 'object' && 'name' in column) {
                orderBy.push(
                    params.sortOrder === 'desc'
                        ? desc(column as AnyColumn)
                        : asc(column as AnyColumn)
                );
            }
        }

        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 10;

        // Get accommodations with relations
        const results = await db.query.accommodations.findMany({
            where,
            with: {
                destination: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        summary: true,
                        isFeatured: true,
                        reviewsCount: true,
                        averageRating: true,
                        accommodationsCount: true,
                        media: true,
                        location: true
                    }
                },
                owner: {
                    columns: {
                        id: true,
                        displayName: true,
                        firstName: true,
                        lastName: true,
                        profile: true,
                        role: true,
                        lifecycleState: true,
                        createdAt: true
                    }
                }
            },
            orderBy,
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        // Get total count
        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;

        return {
            items: results as unknown as Array<
                Accommodation & {
                    destination?: DestinationSummary;
                    owner?: UserSummary;
                }
            >,
            total: totalResult[0]?.count ?? 0
        };
    }

    /**
     * Finds top-rated accommodations with optional filters and relations loaded.
     * Orders by averageRating DESC then reviewsCount DESC and limits the result size.
     *
     * Optimized to load all relations in a single query using Drizzle's `with` clause.
     */
    public async findTopRated(params: {
        limit?: number;
        destinationId?: string;
        type?: string;
        onlyFeatured?: boolean;
        excludeRestricted?: boolean;
    }): Promise<Accommodation[]> {
        const db = getDb();
        const {
            limit = 10,
            destinationId,
            type,
            onlyFeatured = false,
            excludeRestricted = false
        } = params ?? {};

        // Single query with all relations loaded via Drizzle's `with` clause
        const results = await db.query.accommodations.findMany({
            where: (fields, { eq, ne: neOp, isNull: isNullOp }) => {
                const clauses: SQL<unknown>[] = [isNullOp(fields.deletedAt)];
                if (destinationId) clauses.push(eq(fields.destinationId, destinationId));
                if (type) clauses.push(eq(fields.type, type as unknown as typeof fields.type));
                if (onlyFeatured) clauses.push(eq(fields.isFeatured, true));
                if (excludeRestricted) clauses.push(neOp(fields.visibility, 'RESTRICTED'));
                return and(...clauses);
            },
            with: {
                destination: true,
                amenities: { with: { amenity: true } },
                features: { with: { feature: true } }
            },
            orderBy: [desc(accommodations.averageRating), desc(accommodations.reviewsCount)],
            limit
        });

        return results as unknown as Accommodation[];
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation.
     */
    async updateStats(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingInput }
    ): Promise<void> {
        await this.update(
            { id: accommodationId },
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating
            }
        );
    }
}
