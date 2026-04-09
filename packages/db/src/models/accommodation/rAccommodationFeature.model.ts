import type { AccommodationFeature } from '@repo/schemas';
import { count, inArray } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rAccommodationFeature } from '../../schemas/accommodation/r_accommodation_feature.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class RAccommodationFeatureModel extends BaseModelImpl<AccommodationFeature> {
    protected table = rAccommodationFeature;
    public entityName = 'rAccommodationFeature';

    protected getTableName(): string {
        return 'rAccommodationFeatures';
    }

    /**
     * Counts accommodations grouped by feature ID for a batch of feature IDs.
     * Returns a map of featureId -> count. Executes a single query instead of N+1.
     * @param featureIds - Array of feature IDs to count accommodations for
     * @returns Promise resolving to a Map of featureId to accommodation count
     */
    async countAccommodationsByFeatureIds(
        featureIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<Map<string, number>> {
        if (featureIds.length === 0) {
            return new Map();
        }
        const db = this.getClient(tx);
        try {
            const rows = await db
                .select({
                    featureId: rAccommodationFeature.featureId,
                    count: count()
                })
                .from(rAccommodationFeature)
                .where(inArray(rAccommodationFeature.featureId, featureIds as string[]))
                .groupBy(rAccommodationFeature.featureId);

            const result = new Map<string, number>();
            for (const row of rows) {
                result.set(row.featureId, row.count);
            }
            logQuery(this.entityName, 'countAccommodationsByFeatureIds', { featureIds }, result);
            return result;
        } catch (error) {
            logError(
                this.entityName,
                'countAccommodationsByFeatureIds',
                { featureIds },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'countAccommodationsByFeatureIds',
                { featureIds },
                (error as Error).message
            );
        }
    }

    /**
     * Finds a RAccommodationFeature with specified relations populated.
     * @param where - The filter object
     * @param relations - The relations to include (e.g., { accommodation: true })
     * @returns Promise resolving to the entity with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<AccommodationFeature | null> {
        const db = this.getClient(tx);
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['accommodation', 'feature']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const result = await db.query.rAccommodationFeature.findFirst({
                    where: (fields, { eq }) =>
                        eq(fields.accommodationId, where.accommodationId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as unknown as AccommodationFeature | null;
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

/** Singleton instance of RAccommodationFeatureModel for use across the application. */
export const rAccommodationFeatureModel = new RAccommodationFeatureModel();
