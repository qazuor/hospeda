import type { OwnerPromotion } from '@repo/schemas';
import { and, eq, gte, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.ts';
import { ownerPromotions } from '../../schemas/owner-promotion/owner_promotion.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for managing owner promotions in the database.
 * Extends BaseModel to provide CRUD operations for owner promotion entities.
 */
export class OwnerPromotionModel extends BaseModelImpl<OwnerPromotion> {
    protected table = ownerPromotions;
    protected entityName = 'ownerPromotions';

    protected getTableName(): string {
        return 'ownerPromotions';
    }

    /**
     * Finds an owner promotion by its unique slug.
     * @param slug - The slug to search for
     * @returns Promise resolving to the owner promotion or null if not found
     */
    async findBySlug(slug: string): Promise<OwnerPromotion | null> {
        const db = getDb();
        try {
            const result = await db
                .select()
                .from(ownerPromotions)
                .where(eq(ownerPromotions.slug, slug))
                .limit(1);

            logQuery(this.entityName, 'findBySlug', { slug }, result);
            return (result[0] as OwnerPromotion) ?? null;
        } catch (error) {
            logError(this.entityName, 'findBySlug', { slug }, error as Error);
            throw new DbError(this.entityName, 'findBySlug', { slug }, (error as Error).message);
        }
    }

    /**
     * Finds owner promotions by owner ID.
     * @param ownerId - The owner ID to filter by
     * @returns Promise resolving to an object with items and total count
     */
    async findByOwnerId(ownerId: string): Promise<{ items: OwnerPromotion[]; total: number }> {
        try {
            const result = await this.findAll({
                ownerId,
                deletedAt: null
            });

            logQuery(this.entityName, 'findByOwnerId', { ownerId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'findByOwnerId', { ownerId }, error as Error);
            throw new DbError(
                this.entityName,
                'findByOwnerId',
                { ownerId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds active owner promotions by accommodation ID.
     * @param accommodationId - The accommodation ID to filter by
     * @returns Promise resolving to an object with items and total count
     */
    async findActiveByAccommodationId(
        accommodationId: string
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.accommodationId, accommodationId),
                        eq(ownerPromotions.isActive, true),
                        lte(ownerPromotions.validFrom, now),
                        gte(ownerPromotions.validUntil, now)
                    )
                );

            const total = result.length;
            logQuery(this.entityName, 'findActiveByAccommodationId', { accommodationId }, result);
            return { items: result as OwnerPromotion[], total };
        } catch (error) {
            logError(
                this.entityName,
                'findActiveByAccommodationId',
                { accommodationId },
                error as Error
            );
            throw new DbError(
                this.entityName,
                'findActiveByAccommodationId',
                { accommodationId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds active owner promotions by owner ID.
     * @param ownerId - The owner ID to filter by
     * @returns Promise resolving to an object with items and total count
     */
    async findActiveByOwnerId(
        ownerId: string
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        const db = getDb();
        try {
            const now = new Date();
            const result = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.ownerId, ownerId),
                        eq(ownerPromotions.isActive, true),
                        lte(ownerPromotions.validFrom, now),
                        gte(ownerPromotions.validUntil, now)
                    )
                );

            const total = result.length;
            logQuery(this.entityName, 'findActiveByOwnerId', { ownerId }, result);
            return { items: result as OwnerPromotion[], total };
        } catch (error) {
            logError(this.entityName, 'findActiveByOwnerId', { ownerId }, error as Error);
            throw new DbError(
                this.entityName,
                'findActiveByOwnerId',
                { ownerId },
                (error as Error).message
            );
        }
    }

    /**
     * Finds an owner promotion with its related entities populated.
     * @param where - The filter object
     * @param relations - The relations to include
     * @returns Promise resolving to the owner promotion with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean>
    ): Promise<OwnerPromotion | null> {
        const db = getDb();
        try {
            const withObj: Record<string, boolean> = {};
            for (const key of ['owner', 'accommodation', 'createdBy', 'updatedBy', 'deletedBy']) {
                if (relations[key]) withObj[key] = true;
            }

            if (Object.keys(withObj).length > 0) {
                const result = await db.query.ownerPromotions.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as OwnerPromotion | null;
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
