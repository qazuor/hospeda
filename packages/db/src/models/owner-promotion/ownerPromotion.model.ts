import type { OwnerPromotion } from '@repo/schemas';
import { and, eq, gte, lte } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { ownerPromotions } from '../../schemas/owner-promotion/owner_promotion.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Model for managing owner promotions in the database.
 * Extends BaseModel to provide CRUD operations for owner promotion entities.
 */
export class OwnerPromotionModel extends BaseModelImpl<OwnerPromotion> {
    protected table = ownerPromotions;
    public entityName = 'ownerPromotions';

    protected override readonly validRelationKeys = [
        'owner',
        'accommodation',
        'createdBy',
        'updatedBy',
        'deletedBy'
    ] as const;

    protected getTableName(): string {
        return 'ownerPromotions';
    }

    /**
     * Finds an owner promotion by its unique slug.
     * @param slug - The slug to search for
     * @param tx - Optional transaction client
     * @returns Promise resolving to the owner promotion or null if not found
     */
    async findBySlug(slug: string, tx?: DrizzleClient): Promise<OwnerPromotion | null> {
        const db = this.getClient(tx);
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
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findByOwnerId(
        ownerId: string,
        tx?: DrizzleClient
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        try {
            const result = await this.findAll(
                { ownerId, deletedAt: null },
                undefined,
                undefined,
                tx
            );

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
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findActiveByAccommodationId(
        accommodationId: string,
        tx?: DrizzleClient
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.accommodationId, accommodationId),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
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
     * @param tx - Optional transaction client
     * @returns Promise resolving to an object with items and total count
     */
    async findActiveByOwnerId(
        ownerId: string,
        tx?: DrizzleClient
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        const db = this.getClient(tx);
        try {
            const now = new Date();
            const result = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.ownerId, ownerId),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
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
     * @param tx - Optional transaction client
     * @returns Promise resolving to the owner promotion with relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<OwnerPromotion | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, boolean | Record<string, unknown>> = {};
            for (const key of ['owner', 'accommodation', 'createdBy', 'updatedBy', 'deletedBy']) {
                if (relations[key]) withObj[key] = relations[key];
            }

            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.ownerPromotions.findFirst({
                    where: (fields, { eq }) => eq(fields.id, where.id as string),
                    with: withObj
                });

                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return result as OwnerPromotion | null;
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

/** Singleton instance of OwnerPromotionModel for use across the application. */
export const ownerPromotionModel = new OwnerPromotionModel();
