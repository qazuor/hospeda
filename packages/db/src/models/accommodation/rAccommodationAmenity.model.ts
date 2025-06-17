import type { AccommodationAmenityType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { rAccommodationAmenity } from '../../schemas/accommodation/r_accommodation_amenity.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RAccommodationAmenityModel extends BaseModel<AccommodationAmenityType> {
    protected table = rAccommodationAmenity;
    protected entityName = 'rAccommodationAmenity';

    /**
     * Finds a RAccommodationAmenity with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodation: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<AccommodationAmenityType | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['accommodation', 'amenity', 'accommodationsWithAmenity']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rAccommodationAmenity.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.accommodationId, where.accommodationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as AccommodationAmenityType | null;
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
