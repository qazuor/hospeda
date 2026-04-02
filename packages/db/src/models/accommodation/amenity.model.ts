import type { Amenity } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { amenities } from '../../schemas/accommodation/amenity.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class AmenityModel extends BaseModel<Amenity> {
    protected table = amenities;
    protected entityName = 'amenities';

    protected getTableName(): string {
        return 'amenities';
    }

    /**
     * Finds an amenity with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodations: true })
     * @returns Promise resolving to the amenity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<Amenity | null> {
        const db = getDb();
        try {
            if (relations.accommodations) {
                const result = await db.query.amenities.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { accommodationAmenities: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Amenity | null;
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
