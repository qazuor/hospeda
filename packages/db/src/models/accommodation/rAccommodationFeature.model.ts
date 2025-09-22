import type { AccommodationFeature } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { rAccommodationFeature } from '../../schemas/accommodation/r_accommodation_feature.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RAccommodationFeatureModel extends BaseModel<AccommodationFeature> {
    protected table = rAccommodationFeature;
    protected entityName = 'rAccommodationFeature';

    /**
     * Finds a RAccommodationFeature with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodation: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<AccommodationFeature | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['accommodation', 'feature', 'accommodationsWithFeature']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rAccommodationFeature.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.accommodationId, where.accommodationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as AccommodationFeature | null;
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
