import type { OwnerPromotion, PromotionWindow, VenuePromoBadge } from '@repo/schemas';
import { toPromotionWindow } from '@repo/schemas';
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { ownerPromotions } from '../../schemas/owner-promotion/owner_promotion.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Venue-specific owner promotion queries, kept separate from accommodation reads. */
export class OwnerPromotionVenueModel extends BaseModelImpl<OwnerPromotion> {
    protected table = ownerPromotions;
    public entityName = 'ownerPromotions';

    protected getTableName(): string {
        return 'ownerPromotions';
    }

    /** Returns per-venue promo badges with no more than ten distinct windows. */
    async findVenueIdsWithActivePromo({
        venueIds
    }: {
        readonly venueIds: readonly string[];
    }): Promise<ReadonlyMap<string, VenuePromoBadge>> {
        if (venueIds.length === 0) return new Map();
        const db = this.getClient();
        const now = new Date();
        const method = 'findVenueIdsWithActivePromo';
        try {
            const rows = await db
                .select({
                    entityId: ownerPromotions.entityId,
                    hasPlus: sql<boolean>`bool_or(${ownerPromotions.touristAudience} = 'plus')`,
                    hasVip: sql<boolean>`bool_or(${ownerPromotions.touristAudience} = 'vip')`,
                    windowWeekdays: ownerPromotions.windowWeekdays,
                    windowStart: ownerPromotions.windowStart,
                    windowEnd: ownerPromotions.windowEnd
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
                .groupBy(
                    ownerPromotions.entityId,
                    ownerPromotions.windowWeekdays,
                    ownerPromotions.windowStart,
                    ownerPromotions.windowEnd
                );
            const grouped = new Map<
                string,
                {
                    hasPlus: boolean;
                    hasVip: boolean;
                    hasUnscheduled: boolean;
                    windows: Map<string, PromotionWindow>;
                }
            >();
            for (const row of rows) {
                if (!row.entityId) continue;
                const entry = grouped.get(row.entityId) ?? {
                    hasPlus: false,
                    hasVip: false,
                    hasUnscheduled: false,
                    windows: new Map<string, PromotionWindow>()
                };
                entry.hasPlus ||= row.hasPlus;
                entry.hasVip ||= row.hasVip;
                const window = toPromotionWindow(row);
                if (!window) entry.hasUnscheduled = true;
                else if (entry.windows.size < 10) entry.windows.set(JSON.stringify(window), window);
                grouped.set(row.entityId, entry);
            }
            return new Map(
                [...grouped].map(([id, entry]) => [
                    id,
                    {
                        hasPromo: true,
                        vipOnly: !entry.hasPlus,
                        // HOS-2589 D-6: the «Promo» and «VIP» search badges.
                        hasFreePromotion: entry.hasPlus,
                        hasVipPromotion: entry.hasVip,
                        hasUnscheduled: entry.hasUnscheduled,
                        windows: [...entry.windows.values()]
                    }
                ])
            );
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

    /** Finds current public PLUS promotions for a published venue detail. */
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

    /** Counts active venue promotions holding a quota slot, including future starts. */
    async countActiveForVenueOwner(
        { ownerId }: { readonly ownerId: string },
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

    /** Lists every non-deleted promotion for one venue, newest first. */
    async findByVenue(
        { venueId }: { readonly venueId: string },
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

    /** Finds one non-deleted promotion only when it hangs from the given venue. */
    async findOneOfVenue(
        { promotionId, venueId }: { readonly promotionId: string; readonly venueId: string },
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
}
