import type { AccommodationAmenityRelation } from '@repo/schemas';
import { count, inArray } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { rAccommodationAmenity } from '../../schemas/accommodation/r_accommodation_amenity.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class RAccommodationAmenityModel extends BaseModelImpl<AccommodationAmenityRelation> {
    protected table = rAccommodationAmenity;
    protected entityName = 'rAccommodationAmenity';

    protected getTableName(): string {
        return 'rAccommodationAmenities';
    }

    /**
     * Counts accommodations grouped by amenity ID for a batch of amenity IDs.
     * Returns a map of amenityId -> count. Executes a single query instead of N+1.
     * @param amenityIds - Array of amenity IDs to count accommodations for
     * @returns Promise resolving to a Map of amenityId to accommodation count
     */
    async countAccommodationsByAmenityIds(
        amenityIds: readonly string[]
    ): Promise<Map<string, number>> {
        if (amenityIds.length === 0) {
            return new Map();
        }
        const db = getDb();
        try {
            const rows = await db
                .select({
                    amenityId: rAccommodationAmenity.amenityId,
                    count: count()
                })
                .from(rAccommodationAmenity)
                .where(inArray(rAccommodationAmenity.amenityId, amenityIds as string[]))
                .groupBy(rAccommodationAmenity.amenityId);

            const result = new Map<string, number>();
            for (const row of rows) {
                result.set(row.amenityId, row.count);
            }
            logQuery(this.entityName, 'countAccommodationsByAmenityIds', { amenityIds }, result);
            return result;
        } catch (error) {
            logError(
                this.entityName,
                'countAccommodationsByAmenityIds',
                { amenityIds },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'countAccommodationsByAmenityIds',
                { amenityIds },
                (error as Error).message
            );
        }
    }

    /**
     * Finds a RAccommodationAmenity with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodation: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<AccommodationAmenityRelation | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['accommodation', 'amenity']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rAccommodationAmenity.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.accommodationId, where.accommodationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as AccommodationAmenityRelation | null;
            }
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
}
