import type {
    Accommodation,
    AccommodationSearchInput,
    DestinationSummary,
    UserSummary
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema';

// Temporary interfaces for accommodation-related data
interface AccommodationRow {
    accommodationId: string;
    [key: string]: unknown;
}

export class AccommodationModel extends BaseModel<Accommodation> {
    protected table = accommodations;
    protected entityName = 'accommodations';

    public async countByFilters(params: AccommodationSearchInput): Promise<{ count: number }> {
        const db = getDb();

        const whereClauses = [];
        if (params.hostId) {
            whereClauses.push(eq(this.table.ownerId, params.hostId));
        }
        if (params.type) {
            whereClauses.push(eq(this.table.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(gte(this.table.price, params.minPrice));
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(lte(this.table.price, params.maxPrice));
        }
        if (params.destinationId) {
            whereClauses.push(eq(this.table.destinationId, params.destinationId));
        }

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: totalResult[0]?.count ?? 0 };
    }

    public async search(
        params: AccommodationSearchInput
    ): Promise<{ items: Accommodation[]; total: number }> {
        const db = getDb();

        const whereClauses = [];
        if (params.hostId) {
            whereClauses.push(eq(this.table.ownerId, params.hostId));
        }
        if (params.type) {
            whereClauses.push(eq(this.table.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(gte(this.table.price, params.minPrice));
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(lte(this.table.price, params.maxPrice));
        }
        if (params.destinationId) {
            whereClauses.push(eq(this.table.destinationId, params.destinationId));
        }
        // Note: Filtering by amenities would require a join and is more complex.
        // This is a simplified example.

        const where = and(...whereClauses);

        const orderBy = [];
        if (params.sortBy) {
            const column = accommodations[params.sortBy as keyof typeof accommodations];
            if (column) {
                orderBy.push(params.sortOrder === 'desc' ? desc(column) : asc(column));
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

        return { items: items as Accommodation[], total };
    }

    /**
     * Search accommodations with destination and owner relations
     */
    public async searchWithRelations(params: AccommodationSearchInput): Promise<{
        items: Array<
            Accommodation & {
                destination?: DestinationSummary;
                owner?: UserSummary;
            }
        >;
        total: number;
    }> {
        const db = getDb();

        const whereClauses = [];
        if (params.hostId) {
            whereClauses.push(eq(this.table.ownerId, params.hostId));
        }
        if (params.type) {
            whereClauses.push(eq(this.table.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(gte(this.table.price, params.minPrice));
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(lte(this.table.price, params.maxPrice));
        }
        if (params.destinationId) {
            whereClauses.push(eq(this.table.destinationId, params.destinationId));
        }

        const where = and(...whereClauses);

        const orderBy = [];
        if (params.sortBy) {
            const column = accommodations[params.sortBy as keyof typeof accommodations];
            if (column) {
                orderBy.push(params.sortOrder === 'desc' ? desc(column) : asc(column));
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
            items: results as Array<
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
     */
    public async findTopRated(params: {
        limit?: number;
        destinationId?: string;
        type?: string;
        onlyFeatured?: boolean;
    }): Promise<Accommodation[]> {
        const db = getDb();
        const { limit = 10, destinationId, type, onlyFeatured = false } = params ?? {};
        const results = await db.query.accommodations.findMany({
            where: (fields, { eq }) => {
                const clauses: SQL<unknown>[] = [];
                if (destinationId) clauses.push(eq(fields.destinationId, destinationId));
                if (type) clauses.push(eq(fields.type, type as unknown as typeof fields.type));
                if (onlyFeatured) clauses.push(eq(fields.isFeatured, true));
                if (clauses.length === 0) return undefined;
                if (clauses.length === 1) return clauses[0];
                return and(...clauses);
            },
            with: { destination: true },
            orderBy: [desc(accommodations.averageRating), desc(accommodations.reviewsCount)],
            limit
        });
        const items = results as unknown as Accommodation[];
        if (!items || items.length === 0) return items;
        const ids = items.map((i) => i.id);
        // Fetch amenities with amenity joined
        const [amenitiesRows, featuresRows] = await Promise.all([
            db.query.rAccommodationAmenity.findMany({
                where: (fields) => inArray(fields.accommodationId, ids),
                with: { amenity: true }
            }),
            db.query.rAccommodationFeature.findMany({
                where: (fields) => inArray(fields.accommodationId, ids),
                with: { feature: true }
            })
        ]);
        const amenitiesByAcc = new Map<string, unknown[]>();
        for (const row of amenitiesRows as unknown as AccommodationRow[]) {
            const accId = row.accommodationId;
            const arr = amenitiesByAcc.get(accId) ?? [];
            arr.push(row);
            amenitiesByAcc.set(accId, arr);
        }
        const featuresByAcc = new Map<string, unknown[]>();
        for (const row of featuresRows as unknown as AccommodationRow[]) {
            const accId = row.accommodationId;
            const arr = featuresByAcc.get(accId) ?? [];
            arr.push(row);
            featuresByAcc.set(accId, arr);
        }
        return items.map((i) => ({
            ...i,
            amenities: amenitiesByAcc.get(i.id),
            features: featuresByAcc.get(i.id)
        })) as unknown as Accommodation[];
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation.
     */
    async updateStats(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: unknown }
    ): Promise<void> {
        await this.update(
            { id: accommodationId },
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating
                // TODO [b9b79df1-7025-4d33-8ed1-0925b61291fe]: rating needs to be handled separately as it's not part of the main accommodation entity
                // rating: stats.rating
            }
        );
    }
}
