import type {
    Accommodation,
    AccommodationRatingInput,
    AccommodationSearchInput,
    DestinationSummary,
    UserSummary
} from '@repo/schemas';
import type { AnyColumn, SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, exists, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { rAccommodationAmenity } from '../../schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { rAccommodationFeature } from '../../schemas/accommodation/r_accommodation_feature.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

export class AccommodationModel extends BaseModelImpl<Accommodation> {
    protected table = accommodations;
    public entityName = 'accommodations';

    protected override readonly validRelationKeys = ['destination'] as const;

    protected getTableName(): string {
        return 'accommodations';
    }

    public async countByFilters(
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
        tx?: DrizzleClient
    ): Promise<{ count: number }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }

        const where = and(...whereClauses);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);
        const totalResult = await totalQuery;
        return { count: Number(totalResult[0]?.count ?? 0) };
    }

    public async search(
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
        tx?: DrizzleClient
    ): Promise<{ items: Accommodation[]; total: number }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }
        if (params.amenities && params.amenities.length > 0) {
            whereClauses.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(rAccommodationAmenity)
                        .where(
                            and(
                                eq(rAccommodationAmenity.accommodationId, accommodations.id),
                                inArray(rAccommodationAmenity.amenityId, params.amenities)
                            )
                        )
                )
            );
        }
        if (params.features && params.features.length > 0) {
            whereClauses.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(rAccommodationFeature)
                        .where(
                            and(
                                eq(rAccommodationFeature.accommodationId, accommodations.id),
                                inArray(rAccommodationFeature.featureId, params.features)
                            )
                        )
                )
            );
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

        const resultsQuery = db
            .select()
            .from(this.table)
            .where(where)
            .orderBy(...orderBy)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const totalQuery = db.select({ count: count() }).from(this.table).where(where);

        const [items, totalResult] = await Promise.all([resultsQuery, totalQuery]);
        const total = Number(totalResult[0]?.count ?? 0);

        return { items: items as unknown as Accommodation[], total };
    }

    /**
     * Search accommodations with destination and owner relations
     */
    public async searchWithRelations(
        params: AccommodationSearchInput & { excludeRestricted?: boolean },
        tx?: DrizzleClient
    ): Promise<{
        items: Array<
            Accommodation & {
                destination?: DestinationSummary;
                owner?: UserSummary;
            }
        >;
        total: number;
    }> {
        const db = this.getClient(tx);

        const whereClauses: SQL<unknown>[] = [isNull(accommodations.deletedAt)];
        if (params.ownerId) {
            whereClauses.push(eq(accommodations.ownerId, params.ownerId));
        }
        if (params.types && params.types.length > 0) {
            whereClauses.push(
                inArray(accommodations.type, params.types as (typeof accommodations.type._.data)[])
            );
        } else if (params.type) {
            whereClauses.push(eq(accommodations.type, params.type));
        }
        if (params.minPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} >= ${params.minPrice}`);
        }
        if (params.maxPrice !== undefined) {
            whereClauses.push(sql`${accommodations.price} <= ${params.maxPrice}`);
        }
        if (params.destinationIds && params.destinationIds.length > 0) {
            whereClauses.push(inArray(accommodations.destinationId, params.destinationIds));
        } else if (params.destinationId) {
            whereClauses.push(eq(accommodations.destinationId, params.destinationId));
        }
        if (params.excludeRestricted) {
            whereClauses.push(ne(accommodations.visibility, 'RESTRICTED'));
        }
        if (params.minGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int >= ${params.minGuests}`
            );
        }
        if (params.maxGuests !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'capacity')::int <= ${params.maxGuests}`
            );
        }
        if (params.minBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int >= ${params.minBedrooms}`
            );
        }
        if (params.maxBedrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bedrooms')::int <= ${params.maxBedrooms}`
            );
        }
        if (params.minBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int >= ${params.minBathrooms}`
            );
        }
        if (params.maxBathrooms !== undefined) {
            whereClauses.push(
                sql`(${accommodations.extraInfo}->>'bathrooms')::int <= ${params.maxBathrooms}`
            );
        }
        if (params.minRating !== undefined) {
            whereClauses.push(gte(accommodations.averageRating, params.minRating));
        }
        if (params.amenities && params.amenities.length > 0) {
            whereClauses.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(rAccommodationAmenity)
                        .where(
                            and(
                                eq(rAccommodationAmenity.accommodationId, accommodations.id),
                                inArray(rAccommodationAmenity.amenityId, params.amenities)
                            )
                        )
                )
            );
        }
        if (params.features && params.features.length > 0) {
            whereClauses.push(
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(rAccommodationFeature)
                        .where(
                            and(
                                eq(rAccommodationFeature.accommodationId, accommodations.id),
                                inArray(rAccommodationFeature.featureId, params.features)
                            )
                        )
                )
            );
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
            total: Number(totalResult[0]?.count ?? 0)
        };
    }

    /**
     * Finds top-rated accommodations with optional filters and relations loaded.
     * Orders by averageRating DESC then reviewsCount DESC and limits the result size.
     *
     * Optimized to load all relations in a single query using Drizzle's `with` clause.
     */
    public async findTopRated(
        params: {
            limit?: number;
            destinationId?: string;
            type?: string;
            onlyFeatured?: boolean;
            excludeRestricted?: boolean;
        },
        tx?: DrizzleClient
    ): Promise<Accommodation[]> {
        const db = this.getClient(tx);
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
        stats: { reviewsCount: number; averageRating: number; rating: AccommodationRatingInput },
        tx?: DrizzleClient
    ): Promise<void> {
        await this.update(
            { id: accommodationId },
            {
                reviewsCount: stats.reviewsCount,
                averageRating: stats.averageRating,
                rating: stats.rating
            },
            tx
        );
    }

    /**
     * Finds an accommodation with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { destination: true })
     * @returns Promise resolving to the accommodation with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Accommodation | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            if (relations.destination) {
                const db = this.getClient(tx);
                const result = await db.query.accommodations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { destination: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as Accommodation | null;
            }
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
}

/** Singleton instance of AccommodationModel for use across the application. */
export const accommodationModel = new AccommodationModel();
