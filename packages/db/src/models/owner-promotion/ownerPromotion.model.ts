import type { OwnerPromotion } from '@repo/schemas';
import { and, desc, eq, gte, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { ownerPromotions } from '../../schemas/owner-promotion/owner_promotion.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * SQL condition: the promotion targets this accommodation, read DUAL (HOS-2270,
 * release N): the new `entity_id` pair OR the legacy `accommodation_id`.
 *
 * Reading both makes the result independent of whether the data-migration that
 * copies `accommodation_id` into `entity_id` has run yet. Drops its second branch
 * in the release N+1 (contract).
 *
 * @param accommodationId - The accommodation the promotion must target.
 */
export function accommodationTargetCondition(accommodationId: string): SQL {
    return sql`(${ownerPromotions.entityType} = 'accommodation' AND (${ownerPromotions.entityId} = ${accommodationId} OR ${ownerPromotions.accommodationId} = ${accommodationId}))`;
}

/**
 * SQL condition: an owner-wide accommodation promotion, i.e. one that targets ALL of
 * the owner's accommodations (D-4 of SPEC-285).
 *
 * It is `entity_type = 'accommodation'` with NO target in either column. Checking the
 * legacy column too keeps a promotion whose `entity_id` has not been copied yet from
 * being read as owner-wide. A venue promotion is never owner-wide.
 *
 * @param ownerId - The owner the promotion belongs to.
 */
export function ownerWideAccommodationCondition(ownerId: string): SQL {
    return sql`(${ownerPromotions.entityType} = 'accommodation' AND ${ownerPromotions.entityId} IS NULL AND ${ownerPromotions.accommodationId} IS NULL AND ${ownerPromotions.ownerId} = ${ownerId})`;
}

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
     * Find currently active venue promotions for a batch of venue ids.
     *
     * @param params.venueIds - Venue IDs in the current page.
     * @returns A compact map with whether each venue has a PLUS promotion.
     */
    async findVenueIdsWithActivePromo({
        venueIds
    }: {
        readonly venueIds: readonly string[];
    }): Promise<ReadonlyMap<string, { readonly hasPromo: true; readonly vipOnly: boolean }>> {
        if (venueIds.length === 0) return new Map();
        const db = this.getClient();
        const now = new Date();
        const method = 'findVenueIdsWithActivePromo';
        try {
            const rows = await db
                .select({
                    entityId: ownerPromotions.entityId,
                    hasPlus: sql<boolean>`bool_or(${ownerPromotions.touristAudience} = 'plus')`
                })
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.entityType, 'venue'),
                        inArray(ownerPromotions.entityId, [...venueIds]),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                        isNull(ownerPromotions.deletedAt),
                        lte(ownerPromotions.validFrom, now),
                        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
                    )
                )
                .groupBy(ownerPromotions.entityId);
            const badges = new Map<
                string,
                { readonly hasPromo: true; readonly vipOnly: boolean }
            >();
            for (const row of rows) {
                if (row.entityId)
                    badges.set(row.entityId, { hasPromo: true, vipOnly: !row.hasPlus });
            }
            return badges;
        } catch (error) {
            logError(this.entityName, method, { venueCount: venueIds.length }, error as Error);
            throw new DbError(
                this.entityName,
                method,
                { venueCount: venueIds.length },
                (error as Error).message
            );
        }
    }

    /** Find current public PLUS promotions for a published venue detail. */
    async findActiveForVenue({ venueId }: { readonly venueId: string }): Promise<OwnerPromotion[]> {
        const db = this.getClient();
        const now = new Date();
        const method = 'findActiveForVenue';
        try {
            const rows = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.entityType, 'venue'),
                        eq(ownerPromotions.entityId, venueId),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                        eq(ownerPromotions.touristAudience, 'plus'),
                        isNull(ownerPromotions.deletedAt),
                        lte(ownerPromotions.validFrom, now),
                        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
                    )
                );
            return rows as OwnerPromotion[];
        } catch (error) {
            logError(this.entityName, method, { venueId }, error as Error);
            throw new DbError(this.entityName, method, { venueId }, (error as Error).message);
        }
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
                        accommodationTargetCondition(accommodationId),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
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
     *   - the promotion targets this accommodation (`entity_type = 'accommodation'`
     *     and `entity_id` or, until release N+1, `accommodation_id` equals it), OR
     *   - it is owner-wide (`entity_type = 'accommodation'` with no target) and
     *     `ownerId = $ownerId`.
     * Venue promotions are never returned (HOS-2270).
     *
     * This prevents other owners' null-accommodationId promos from leaking onto
     * this accommodation (the AND `ownerId = $ownerId` guard isolates the owner).
     *
     * Date window and ACTIVE gates are applied here so the result
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

            // Targeted promo: matches this accommodation exactly (dual read, HOS-2270).
            const targetedCondition = accommodationTargetCondition(accommodationId);

            // Owner-wide promo: accommodation type with no target AND belongs to this
            // owner. A venue promotion is never read as owner-wide (HOS-2270).
            const ownerWideCondition = ownerWideAccommodationCondition(ownerId);

            const whereClause = and(
                eq(ownerPromotions.lifecycleState, 'ACTIVE'),
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

            const targetedCondition = accommodationTargetCondition(accommodationId);
            const ownerWideCondition = ownerWideAccommodationCondition(ownerId);

            const whereClause = and(
                eq(ownerPromotions.lifecycleState, 'ACTIVE'),
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
     * Counts the promotions of an owner's VENUES that occupy a slot of the plan's
     * `max_active_promotions` limit (HOS-2270).
     *
     * A promotion occupies a slot while it is `ACTIVE`, not soft-deleted and not
     * expired. A promotion scheduled for the future (`validFrom` ahead) DOES
     * count: leaving it out would let an owner stack unlimited scheduled
     * promotions and have them all go live at once. Accommodation promotions are
     * never counted here, so the two verticals do not spend each other's quota.
     *
     * @param params.ownerId - The owner whose venue promotions are counted.
     * @param tx - Optional transaction client.
     * @returns The number of venue promotions holding a slot.
     */
    async countActiveForVenueOwner(
        { ownerId }: { ownerId: string },
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const method = 'countActiveForVenueOwner';
        try {
            const now = new Date();
            const rows = await db
                .select({ id: ownerPromotions.id })
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.ownerId, ownerId),
                        eq(ownerPromotions.entityType, 'venue'),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                        isNull(ownerPromotions.deletedAt),
                        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
                    )
                );
            logQuery(this.entityName, method, { ownerId }, { total: rows.length });
            return rows.length;
        } catch (error) {
            logError(this.entityName, method, { ownerId }, error as Error);
            throw new DbError(this.entityName, method, { ownerId }, (error as Error).message);
        }
    }

    /**
     * Lists every non-deleted promotion of one venue, in any lifecycle state, newest
     * first (HOS-2270). The owner's editor reads this; the public venue page reads
     * its own filtered path.
     *
     * @param params.venueId - The venue the promotions hang from.
     * @param tx - Optional transaction client.
     * @returns The venue's promotions.
     */
    async findByVenue(
        { venueId }: { venueId: string },
        tx?: DrizzleClient
    ): Promise<OwnerPromotion[]> {
        const db = this.getClient(tx);
        const method = 'findByVenue';
        try {
            const rows = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.entityType, 'venue'),
                        eq(ownerPromotions.entityId, venueId),
                        isNull(ownerPromotions.deletedAt)
                    )
                )
                .orderBy(desc(ownerPromotions.createdAt));
            logQuery(this.entityName, method, { venueId }, { total: rows.length });
            return rows as OwnerPromotion[];
        } catch (error) {
            logError(this.entityName, method, { venueId }, error as Error);
            throw new DbError(this.entityName, method, { venueId }, (error as Error).message);
        }
    }

    /**
     * Finds one non-deleted promotion by id, only if it hangs from the given venue.
     * A promotion of another venue, of an accommodation, or one that does not exist
     * all answer `null`: the caller turns every one of them into the same 404.
     *
     * @param params.promotionId - The promotion id.
     * @param params.venueId - The venue it must hang from.
     * @param tx - Optional transaction client.
     * @returns The promotion, or `null`.
     */
    async findOneOfVenue(
        { promotionId, venueId }: { promotionId: string; venueId: string },
        tx?: DrizzleClient
    ): Promise<OwnerPromotion | null> {
        const db = this.getClient(tx);
        const method = 'findOneOfVenue';
        try {
            const rows = await db
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.id, promotionId),
                        eq(ownerPromotions.entityType, 'venue'),
                        eq(ownerPromotions.entityId, venueId),
                        isNull(ownerPromotions.deletedAt)
                    )
                )
                .limit(1);
            logQuery(this.entityName, method, { promotionId, venueId }, rows);
            return (rows[0] as OwnerPromotion | undefined) ?? null;
        } catch (error) {
            logError(this.entityName, method, { promotionId, venueId }, error as Error);
            throw new DbError(
                this.entityName,
                method,
                { promotionId, venueId },
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
