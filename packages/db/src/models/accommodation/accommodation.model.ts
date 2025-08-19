import type {
    AccommodationAmenityType,
    AccommodationFeatureType,
    AccommodationRatingType,
    AccommodationType,
    BaseSearchType,
    SortType
} from '@repo/types';
import type { SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema';

type AccommodationSearchType = BaseSearchType & {
    filters?: {
        types?: string[];
        priceMin?: number;
        priceMax?: number;
        amenities?: string[];
        visibility?: string[];
        ownerId?: string;
        destinationId?: string;
    };
};

export class AccommodationModel extends BaseModel<AccommodationType> {
    protected table = accommodations;
    protected entityName = 'accommodations';

    public async countByFilters(params: AccommodationSearchType): Promise<{ count: number }> {
        const db = getDb();
        const { filters } = params;

        const whereClauses = [];
        if (filters?.ownerId) {
            whereClauses.push(eq(this.table.ownerId, filters.ownerId));
        }
        if (filters?.types && filters.types.length > 0) {
            whereClauses.push(inArray(this.table.type, filters.types));
        }
        if (filters?.priceMin !== undefined) {
            whereClauses.push(gte(this.table.price, filters.priceMin));
        }
        if (filters?.priceMax !== undefined) {
            whereClauses.push(lte(this.table.price, filters.priceMax));
        }
        if (filters?.destinationId) {
            whereClauses.push(eq(this.table.destinationId, filters.destinationId));
        }

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: totalResult[0]?.count ?? 0 };
    }

    public async search(
        params: AccommodationSearchType
    ): Promise<{ items: AccommodationType[]; total: number }> {
        const db = getDb();
        const { filters, sort, pagination } = params;

        const whereClauses = [];
        if (filters?.ownerId) {
            whereClauses.push(eq(this.table.ownerId, filters.ownerId));
        }
        if (filters?.types && filters.types.length > 0) {
            whereClauses.push(inArray(this.table.type, filters.types));
        }
        if (filters?.priceMin !== undefined) {
            whereClauses.push(gte(this.table.price, filters.priceMin));
        }
        if (filters?.priceMax !== undefined) {
            whereClauses.push(lte(this.table.price, filters.priceMax));
        }
        if (filters?.destinationId) {
            whereClauses.push(eq(this.table.destinationId, filters.destinationId));
        }
        // Note: Filtering by amenities would require a join and is more complex.
        // This is a simplified example.

        const where = and(...whereClauses);

        const orderBy =
            sort?.map((s: SortType) => {
                const column = accommodations[s.field as keyof typeof accommodations];
                if (!column) throw new Error(`Invalid sort field: ${s.field}`);
                return s.direction === 'ASC' ? asc(column) : desc(column);
            }) ?? [];

        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;

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

        return { items: items as AccommodationType[], total };
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
    }): Promise<AccommodationType[]> {
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
        const items = results as unknown as AccommodationType[];
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
        const amenitiesByAcc = new Map<string, AccommodationAmenityType[]>();
        for (const row of amenitiesRows as unknown as AccommodationAmenityType[]) {
            const accId = row.accommodationId as unknown as string;
            const arr = amenitiesByAcc.get(accId) ?? [];
            arr.push(row);
            amenitiesByAcc.set(accId, arr);
        }
        const featuresByAcc = new Map<string, AccommodationFeatureType[]>();
        for (const row of featuresRows as unknown as AccommodationFeatureType[]) {
            const accId = row.accommodationId as unknown as string;
            const arr = featuresByAcc.get(accId) ?? [];
            arr.push(row);
            featuresByAcc.set(accId, arr);
        }
        return items.map((i) => ({
            ...i,
            amenities: amenitiesByAcc.get(i.id),
            features: featuresByAcc.get(i.id)
        })) as unknown as AccommodationType[];
    }

    /**
     * Updates the stats (reviewsCount, averageRating, rating) for the accommodation.
     */
    async updateStats(
        accommodationId: string,
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingType }
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
