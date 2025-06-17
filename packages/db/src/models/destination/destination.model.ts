import type { DestinationType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { destinations } from '../../schemas/destination/destination.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class DestinationModel extends BaseModel<DestinationType> {
    protected table = destinations;
    protected entityName = 'destinations';

    /**
     * Finds a destination with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodations: true })
     * @returns Promise resolving to the destination with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<DestinationType | null> {
        const db = getDb();
        try {
            // Construir objeto 'with' dinámicamente
            const withObj: Record<string, boolean> = {};
            for (const key of [
                'accommodations',
                'reviews',
                'tags',
                'attractions',
                'createdBy',
                'updatedBy',
                'deletedBy'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.destinations.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as DestinationType | null;
            }
            // Fallback a base findOne si no hay relaciones
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
