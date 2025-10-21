import type { Accommodation } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { getDb } from '../client';
import { accommodations } from '../schemas/accommodation/accommodation.dbschema';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Model for the Accommodation entity.
 * Extends BaseModel to provide CRUD and relation methods.
 */
export class AccommodationModel extends BaseModel<Accommodation> {
    /**
     * The Drizzle table schema for accommodations.
     */
    protected table = accommodations;
    /**
     * The entity name for logging and error context.
     */
    protected entityName = 'accommodations';

    protected getTableName(): string {
        return 'accommodations';
    }

    /**
     * Finds an accommodation with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { destination: true })
     * @returns Promise resolving to the accommodation with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<Accommodation | null> {
        const db = getDb();
        try {
            // Example: only supports 'destination' relation for now
            if (relations.destination) {
                const result = await db.query.accommodations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { destination: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Accommodation | null;
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
export const accommodationModel = new AccommodationModel();
