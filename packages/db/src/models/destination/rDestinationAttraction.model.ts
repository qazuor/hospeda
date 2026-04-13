import type { DestinationAttractionRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

export class RDestinationAttractionModel extends BaseModelImpl<DestinationAttractionRelation> {
    protected table = rDestinationAttraction;
    public entityName = 'rDestinationAttraction';

    protected override readonly validRelationKeys = [
        'destination',
        'attraction',
        'destinationsWithAttraction'
    ] as const;

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
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<DestinationAttractionRelation | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['destination', 'attraction', 'destinationsWithAttraction']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.rDestinationAttraction.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.destinationId, where.destinationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as DestinationAttractionRelation | null;
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

/** Singleton instance of RDestinationAttractionModel for use across the application. */
export const rDestinationAttractionModel = new RDestinationAttractionModel();
