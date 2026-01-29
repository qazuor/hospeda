import type { Amenity } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { getDb } from '../client';
import { amenities } from '../schemas/accommodation/amenity.dbschema';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Model for the Amenity entity.
 * Extends BaseModel to provide CRUD and relation methods.
 */
export class AmenityModel extends BaseModel<Amenity> {
    /**
     * The Drizzle table schema for amenities.
     */
    protected table = amenities;
    /**
     * The entity name for logging and error context.
     */
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
            // Example: only supports 'accommodations' relation for now
            if (relations.accommodations) {
                const result = await db.query.amenities.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { accommodationAmenities: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Amenity | null;
            }
            // Fallback to base findOne if no relations requested
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

// Export a singleton instance for convenience
export const amenityModel = new AmenityModel();
