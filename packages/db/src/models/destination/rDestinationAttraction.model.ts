import type { DestinationAttractionRelation } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema';
import { DbError } from '../../utils/error';
import { logError, logQuery } from '../../utils/logger';

export class RDestinationAttractionModel extends BaseModel<DestinationAttractionRelation> {
    protected table = rDestinationAttraction;
    protected entityName = 'rDestinationAttraction';

    protected getTableName(): string {
        return 'rDestinationAttractions';
    }

    /**
     * Finds a RDestinationAttraction with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { destination: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<DestinationAttractionRelation | null> {
        const db = getDb();
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['destination', 'attraction', 'destinationsWithAttraction']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rDestinationAttraction.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.destinationId, where.destinationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as DestinationAttractionRelation | null;
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
