import type { AccommodationType, BaseSearchType, SortType } from '@repo/types';
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
}
