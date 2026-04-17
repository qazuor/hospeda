import type { Amenity } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { amenities } from '../../schemas/accommodation/amenity.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

export class AmenityModel extends BaseModelImpl<Amenity> {
    protected table = amenities;
    public entityName = 'amenities';

    protected override readonly validRelationKeys = ['accommodationAmenities'] as const;

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
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<Amenity | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            if (relations.accommodations) {
                const db = this.getClient(tx);
                const result = await db.query.amenities.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: { accommodationAmenities: true }
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as Amenity | null;
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

/** Singleton instance of AmenityModel for use across the application. */
export const amenityModel = new AmenityModel();
