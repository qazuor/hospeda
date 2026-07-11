import type { DestinationPointOfInterestRelation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rDestinationPointOfInterest } from '../../schemas/destination/r_destination_point_of_interest.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Model for the `r_destination_point_of_interest` join table (HOS-113,
 * M2M — OQ-1). Mirrors `RDestinationAttractionModel` exactly.
 */
export class RDestinationPointOfInterestModel extends BaseModelImpl<DestinationPointOfInterestRelation> {
    protected table = rDestinationPointOfInterest;
    public entityName = 'rDestinationPointOfInterest';

    protected override readonly validRelationKeys = [
        'destination',
        'pointOfInterest',
        'destinationsWithPointOfInterest'
    ] as const;

    protected getTableName(): string {
        return 'rDestinationPointOfInterest';
    }

    /**
     * Finds a RDestinationPointOfInterest with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { destination: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<DestinationPointOfInterestRelation | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, true> = {};
            for (const key of [
                'destination',
                'pointOfInterest',
                'destinationsWithPointOfInterest'
            ]) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.rDestinationPointOfInterest.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.destinationId, where.destinationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                // DRIZZLE-LIMITATION: findFirst with `with: { destination, pointOfInterest, destinationsWithPointOfInterest }` returns nested join shape; DestinationPointOfInterestRelation entity uses domain-mapped relation types.
                return result as unknown as DestinationPointOfInterestRelation | null;
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

/** Singleton instance of RDestinationPointOfInterestModel for use across the application. */
export const rDestinationPointOfInterestModel = new RDestinationPointOfInterestModel();
