import type { OwnerPromotion } from '@repo/schemas';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
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
     *
     * SPEC-167 T-004: plan-restricted promotions are excluded. A restricted
     * promotion is not considered active from the public perspective — it must
     * not appear on the accommodation detail page and must not consume the
     * host's MAX_ACTIVE_PROMOTIONS cap.
     *
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
                        eq(ownerPromotions.planRestricted, false),
                        lte(ownerPromotions.validFrom, now),
                        // NULL validUntil means no expiry — treat as always valid (SPEC-285 FIX 4).
                        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
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
     *
     * SPEC-167 T-004: plan-restricted promotions are excluded. A restricted
     * promotion is not active from the public/cap perspective — it must not
     * appear in public reads and must not count toward the host's
     * MAX_ACTIVE_PROMOTIONS cap.
     *
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
                        eq(ownerPromotions.planRestricted, false),
                        lte(ownerPromotions.validFrom, now),
                        // NULL validUntil means no expiry — treat as always valid (SPEC-285 FIX 4).
                        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
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
     * Finds active owner promotions for a given accommodation, including owner-wide
     * (accommodationId IS NULL) promotions from the same owner.
     *
     * Implements D-4 from SPEC-285: the public accommodation detail page must show
     * promotions where either:
     *   - `accommodationId = $accommodationId` (targeted at this listing), OR
     *   - `accommodationId IS NULL AND ownerId = $ownerId` (owner-wide promo)
     *
     * This prevents other owners' null-accommodationId promos from leaking onto
     * this accommodation (the AND `ownerId = $ownerId` guard isolates the owner).
     *
     * Date window and ACTIVE/planRestricted gates are applied here so the result
     * set is identical to what `_executeSearch` returns for the same conditions.
     *
     * @param params - `{ accommodationId, ownerId }` — both must be resolved by the caller.
     * @param options - Optional pagination parameters.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to an object with `items` and `total`.
     */
    async findActiveForAccommodation(
        { accommodationId, ownerId }: { accommodationId: string; ownerId: string },
        options?: { page?: number; pageSize?: number },
        tx?: DrizzleClient
    ): Promise<{ items: OwnerPromotion[]; total: number }> {
        const db = this.getClient(tx);
        const now = new Date();
        const method = 'findActiveForAccommodation';
        try {
            const validWindowCondition = and(
                lte(ownerPromotions.validFrom, now),
                or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
            );

            // Targeted promo: matches this accommodation exactly.
            const targetedCondition = eq(ownerPromotions.accommodationId, accommodationId);

            // Owner-wide promo: accommodationId IS NULL AND belongs to this owner.
            const ownerWideCondition = and(
                isNull(ownerPromotions.accommodationId),
                eq(ownerPromotions.ownerId, ownerId)
            );

            const whereClause = and(
                eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                eq(ownerPromotions.planRestricted, false),
                isNull(ownerPromotions.deletedAt),
                validWindowCondition,
                or(targetedCondition, ownerWideCondition)
            );

            const page = options?.page ?? 1;
            const pageSize = options?.pageSize ?? 20;
            const offset = (page - 1) * pageSize;

            const [rows, countRows] = await Promise.all([
                db.select().from(ownerPromotions).where(whereClause).limit(pageSize).offset(offset),
                db.select().from(ownerPromotions).where(whereClause)
            ]);

            const total = countRows.length;
            logQuery(this.entityName, method, { accommodationId, ownerId }, { items: rows, total });
            return { items: rows as OwnerPromotion[], total };
        } catch (error) {
            logError(this.entityName, method, { accommodationId, ownerId }, error as Error);
            throw new DbError(
                this.entityName,
                method,
                { accommodationId, ownerId },
                (error as Error).message
            );
        }
    }

    /**
     * Counts active owner promotions for a given accommodation, including owner-wide
     * (accommodationId IS NULL) promotions from the same owner.
     *
     * Mirrors the WHERE conditions of `findActiveForAccommodation` exactly so that
     * pagination `total` from `_executeSearch` and the standalone count from
     * `_executeCount` are always identical (SPEC-285 FIX 3).
     *
     * Unlike `findActiveForAccommodation`, this method issues a single COUNT(*) query
     * and discards no rows — suitable for the D-4 count path in `_executeCount`.
     *
     * @param params - `{ accommodationId, ownerId }` — both must be resolved by the caller.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to the total number of matching promotions.
     */
    async countActiveForAccommodation(
        { accommodationId, ownerId }: { accommodationId: string; ownerId: string },
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const now = new Date();
        const method = 'countActiveForAccommodation';
        try {
            const validWindowCondition = and(
                lte(ownerPromotions.validFrom, now),
                or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
            );

            const targetedCondition = eq(ownerPromotions.accommodationId, accommodationId);
            const ownerWideCondition = and(
                isNull(ownerPromotions.accommodationId),
                eq(ownerPromotions.ownerId, ownerId)
            );

            const whereClause = and(
                eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                eq(ownerPromotions.planRestricted, false),
                isNull(ownerPromotions.deletedAt),
                validWindowCondition,
                or(targetedCondition, ownerWideCondition)
            );

            const rows = await db.select().from(ownerPromotions).where(whereClause);
            const total = rows.length;

            logQuery(this.entityName, method, { accommodationId, ownerId }, { total });
            return total;
        } catch (error) {
            logError(this.entityName, method, { accommodationId, ownerId }, error as Error);
            throw new DbError(
                this.entityName,
                method,
                { accommodationId, ownerId },
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
