/**
 * Tourist-facing reads of the free / VIP promotions model (HOS-2589).
 *
 * These reads return EVERY audience on purpose: the decision of what a reader sees
 * is taken afterwards by the pure resolver (`resolvePromotionVisibility` in
 * service-core), which needs the whole page to pick the free quota and to build
 * the locked items. Never serialize their rows to a reader directly.
 */
import type { OwnerPromotion } from '@repo/schemas';
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, type SQL, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { ownerPromotions } from '../../schemas/owner-promotion/owner_promotion.dbschema.ts';
import { venues } from '../../schemas/venue/venue.dbschema.ts';
import { DbError } from '../../utils/error.ts';
import { logError } from '../../utils/logger.ts';

/** A public place a promotion hangs on. */
export interface PromotionPlaceRow {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
}

/** Presence of active promotions per audience, for the search badges (D-6). */
export interface PromotionPresence {
    readonly hasFreePromotion: boolean;
    readonly hasVipPromotion: boolean;
}

/** An active «Solo VIP» promotion, as the entitlement-loss sweep reads it (D-8). */
export interface ActiveVipPromotionRow {
    readonly id: string;
    readonly ownerId: string;
    readonly entityType: 'accommodation' | 'venue';
    readonly title: string;
}

/** ACTIVE, not deleted, inside its validity window at `now`. */
function activeNow(now: Date): SQL {
    return and(
        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
        isNull(ownerPromotions.deletedAt),
        lte(ownerPromotions.validFrom, now),
        or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now))
    ) as SQL;
}

/**
 * The promotion hangs on ONE public place: a targeted accommodation promotion whose
 * accommodation is PUBLISHED, or a venue promotion whose venue is PUBLISHED. An
 * owner-wide accommodation promotion has no single place and is excluded: it is
 * shown on each of the owner's accommodation detail pages instead.
 */
function onePublicPlace(): SQL {
    return sql`(
        (${ownerPromotions.entityType} = 'accommodation' AND EXISTS (
            SELECT 1 FROM ${accommodations}
            WHERE ${accommodations.id} = COALESCE(${ownerPromotions.entityId}, ${ownerPromotions.accommodationId})
              AND ${accommodations.publicationStatus} = 'PUBLISHED'
              AND ${accommodations.deletedAt} IS NULL
        ))
        OR (${ownerPromotions.entityType} = 'venue' AND EXISTS (
            SELECT 1 FROM ${venues}
            WHERE ${venues.id} = ${ownerPromotions.entityId}
              AND ${venues.publicationStatus} = 'PUBLISHED'
              AND ${venues.deletedAt} IS NULL
        ))
    )`;
}

/** Newest activation first; a row never activated sorts by creation. */
const NEWEST_FIRST = [
    desc(sql`COALESCE(${ownerPromotions.firstActivatedAt}, ${ownerPromotions.createdAt})`),
    desc(ownerPromotions.id)
];

/** Tourist-facing promotion queries, every audience (see the file docblock). */
export class OwnerPromotionTouristModel extends BaseModelImpl<OwnerPromotion> {
    protected table = ownerPromotions;
    public entityName = 'ownerPromotions';

    protected getTableName(): string {
        return 'ownerPromotions';
    }

    /** Wraps a query so a failure is logged and rethrown as a `DbError`. */
    private async run<T>(
        method: string,
        params: Record<string, unknown>,
        query: () => Promise<T>
    ): Promise<T> {
        try {
            return await query();
        } catch (error) {
            logError(this.entityName, method, params, error as Error);
            throw new DbError(this.entityName, method, params, (error as Error).message);
        }
    }

    /** Every audience of a venue's current promotions (the venue detail page). */
    async findActiveForVenueAllAudiences({
        venueId,
        now = new Date()
    }: {
        readonly venueId: string;
        readonly now?: Date;
    }): Promise<OwnerPromotion[]> {
        return this.run('findActiveForVenueAllAudiences', { venueId }, async () => {
            const rows = await this.getClient()
                .select()
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.entityType, 'venue'),
                        eq(ownerPromotions.entityId, venueId),
                        activeNow(now)
                    )
                )
                .orderBy(...NEWEST_FIRST);
            return rows as OwnerPromotion[];
        });
    }

    /** One page of the `/promociones/` listing: current promotions on a public place. */
    async findActiveListingPage({
        page,
        pageSize,
        now = new Date()
    }: {
        readonly page: number;
        readonly pageSize: number;
        readonly now?: Date;
    }): Promise<{ items: OwnerPromotion[]; total: number }> {
        return this.run('findActiveListingPage', { page, pageSize }, async () => {
            const where = and(activeNow(now), onePublicPlace());
            const db = this.getClient();
            const [rows, totals] = await Promise.all([
                db
                    .select()
                    .from(ownerPromotions)
                    .where(where)
                    .orderBy(...NEWEST_FIRST)
                    .limit(pageSize)
                    .offset((page - 1) * pageSize),
                db.select({ total: sql<number>`count(*)::int` }).from(ownerPromotions).where(where)
            ]);
            return { items: rows as OwnerPromotion[], total: Number(totals[0]?.total ?? 0) };
        });
    }

    /**
     * Promotions that FIRST became active in `[from, to)` and are still current at
     * `now` (the weekly VIP digest, §7.7). Both audiences; at most `limit` rows, newest
     * first, plus the total.
     */
    async findFirstActivatedBetween({
        from,
        to,
        now,
        limit
    }: {
        readonly from: Date;
        readonly to: Date;
        readonly now: Date;
        readonly limit: number;
    }): Promise<{ items: OwnerPromotion[]; total: number }> {
        return this.run('findFirstActivatedBetween', { from, to }, async () => {
            const where = and(
                gte(ownerPromotions.firstActivatedAt, from),
                lt(ownerPromotions.firstActivatedAt, to),
                eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                isNull(ownerPromotions.deletedAt),
                or(isNull(ownerPromotions.validUntil), gte(ownerPromotions.validUntil, now)),
                onePublicPlace()
            );
            const db = this.getClient();
            const [rows, totals] = await Promise.all([
                db
                    .select()
                    .from(ownerPromotions)
                    .where(where)
                    .orderBy(...NEWEST_FIRST)
                    .limit(limit),
                db.select({ total: sql<number>`count(*)::int` }).from(ownerPromotions).where(where)
            ]);
            return { items: rows as OwnerPromotion[], total: Number(totals[0]?.total ?? 0) };
        });
    }

    /** The public places (id, slug, name) of a batch of accommodation and venue ids. */
    async findPublicPlaces({
        accommodationIds,
        venueIds
    }: {
        readonly accommodationIds: readonly string[];
        readonly venueIds: readonly string[];
    }): Promise<{
        accommodations: ReadonlyMap<string, PromotionPlaceRow>;
        venues: ReadonlyMap<string, PromotionPlaceRow>;
    }> {
        return this.run(
            'findPublicPlaces',
            { accommodations: accommodationIds.length, venues: venueIds.length },
            async () => {
                const db = this.getClient();
                const [accommodationRows, venueRows] = await Promise.all([
                    accommodationIds.length === 0
                        ? Promise.resolve([])
                        : db
                              .select({
                                  id: accommodations.id,
                                  slug: accommodations.slug,
                                  name: accommodations.name
                              })
                              .from(accommodations)
                              .where(
                                  and(
                                      inArray(accommodations.id, [...accommodationIds]),
                                      eq(accommodations.publicationStatus, 'PUBLISHED'),
                                      isNull(accommodations.deletedAt)
                                  )
                              ),
                    venueIds.length === 0
                        ? Promise.resolve([])
                        : db
                              .select({ id: venues.id, slug: venues.slug, name: venues.name })
                              .from(venues)
                              .where(
                                  and(
                                      inArray(venues.id, [...venueIds]),
                                      eq(venues.publicationStatus, 'PUBLISHED'),
                                      isNull(venues.deletedAt)
                                  )
                              )
                ]);
                return {
                    accommodations: new Map(accommodationRows.map((row) => [row.id, row])),
                    venues: new Map(venueRows.map((row) => [row.id, row]))
                };
            }
        );
    }

    /**
     * Search-badge presence for a batch of accommodations (D-6): targeted promotions
     * plus the owner-wide ones of each accommodation's owner. Presence only.
     */
    async findAccommodationPromotionPresence({
        listings,
        now = new Date()
    }: {
        readonly listings: readonly { readonly id: string; readonly ownerId: string }[];
        readonly now?: Date;
    }): Promise<ReadonlyMap<string, PromotionPresence>> {
        if (listings.length === 0) return new Map();
        return this.run(
            'findAccommodationPromotionPresence',
            { count: listings.length },
            async () => {
                const ids = [...new Set(listings.map((listing) => listing.id))];
                const ownerIds = [...new Set(listings.map((listing) => listing.ownerId))];
                const rows = await this.getClient()
                    .select({
                        targetId: sql<
                            string | null
                        >`COALESCE(${ownerPromotions.entityId}, ${ownerPromotions.accommodationId})`,
                        ownerId: ownerPromotions.ownerId,
                        hasPlus: sql<boolean>`bool_or(${ownerPromotions.touristAudience} = 'plus')`,
                        hasVip: sql<boolean>`bool_or(${ownerPromotions.touristAudience} = 'vip')`
                    })
                    .from(ownerPromotions)
                    .where(
                        and(
                            eq(ownerPromotions.entityType, 'accommodation'),
                            activeNow(now),
                            or(
                                inArray(ownerPromotions.entityId, ids),
                                inArray(ownerPromotions.accommodationId, ids),
                                and(
                                    isNull(ownerPromotions.entityId),
                                    isNull(ownerPromotions.accommodationId),
                                    inArray(ownerPromotions.ownerId, ownerIds)
                                )
                            )
                        )
                    )
                    .groupBy(
                        sql`COALESCE(${ownerPromotions.entityId}, ${ownerPromotions.accommodationId})`,
                        ownerPromotions.ownerId
                    );
                const targeted = new Map<string, PromotionPresence>();
                const ownerWide = new Map<string, PromotionPresence>();
                for (const row of rows) {
                    const presence = {
                        hasFreePromotion: Boolean(row.hasPlus),
                        hasVipPromotion: Boolean(row.hasVip)
                    };
                    if (row.targetId) targeted.set(row.targetId, presence);
                    else ownerWide.set(row.ownerId, presence);
                }
                const result = new Map<string, PromotionPresence>();
                for (const { id, ownerId } of listings) {
                    const own = targeted.get(id);
                    const wide = ownerWide.get(ownerId);
                    const hasFreePromotion = Boolean(
                        own?.hasFreePromotion || wide?.hasFreePromotion
                    );
                    const hasVipPromotion = Boolean(own?.hasVipPromotion || wide?.hasVipPromotion);
                    if (hasFreePromotion || hasVipPromotion) {
                        result.set(id, { hasFreePromotion, hasVipPromotion });
                    }
                }
                return result;
            }
        );
    }

    /** Every ACTIVE, not deleted «Solo VIP» promotion (the entitlement-loss sweep, D-8). */
    async findActiveVipPromotions(): Promise<ActiveVipPromotionRow[]> {
        return this.run('findActiveVipPromotions', {}, async () => {
            const rows = await this.getClient()
                .select({
                    id: ownerPromotions.id,
                    ownerId: ownerPromotions.ownerId,
                    entityType: ownerPromotions.entityType,
                    title: ownerPromotions.title
                })
                .from(ownerPromotions)
                .where(
                    and(
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                        eq(ownerPromotions.touristAudience, 'vip'),
                        isNull(ownerPromotions.deletedAt)
                    )
                );
            return rows as ActiveVipPromotionRow[];
        });
    }

    /**
     * Pauses the given «Solo VIP» promotions on the loss of `vip_only_promotions`
     * (D-8): ACTIVE → INACTIVE with `vip_paused_at` set. Only rows still ACTIVE and
     * `vip` are touched, so a second run changes nothing (AC-39).
     *
     * @returns The ids actually paused by this call.
     */
    async pauseVipPromotions({
        ids,
        now
    }: {
        readonly ids: readonly string[];
        readonly now: Date;
    }): Promise<string[]> {
        if (ids.length === 0) return [];
        return this.run('pauseVipPromotions', { count: ids.length }, async () => {
            const rows = await this.getClient()
                .update(ownerPromotions)
                .set({ lifecycleState: 'INACTIVE', vipPausedAt: now, updatedAt: now })
                .where(
                    and(
                        inArray(ownerPromotions.id, [...ids]),
                        eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                        eq(ownerPromotions.touristAudience, 'vip'),
                        isNull(ownerPromotions.deletedAt)
                    )
                )
                .returning({ id: ownerPromotions.id });
            return rows.map((row) => row.id);
        });
    }
}

/** Singleton instance of {@link OwnerPromotionTouristModel}. */
export const ownerPromotionTouristModel = new OwnerPromotionTouristModel();
