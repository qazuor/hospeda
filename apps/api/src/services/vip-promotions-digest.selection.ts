/**
 * Database reads of the weekly VIP promotions digest (HOS-2589 §7.7).
 *
 * Candidates come from live subscription titles (own `tourist-vip` or another
 * vertical's title that inherits VIP); the job then CONFIRMS each one through the
 * TOURIST effective set (`vip_promotions_access`), never by role or plan slug.
 *
 * @module apps/api/services/vip-promotions-digest.selection
 */
import {
    and,
    getDb,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    ownerPromotionTouristModel,
    subscriptions,
    users
} from '@repo/db';
import type { OwnerPromotion } from '@repo/schemas';
import type { PromotionPlaces } from '@repo/service-core';

/** A promotion of the week and its public place. */
export interface DigestPromotionRow {
    readonly promotion: OwnerPromotion;
    readonly place: { readonly slug: string; readonly name: string } | null;
}

/** A digest recipient candidate. */
export interface VipDigestRecipient {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly settings: unknown;
}

/** The public place of one promotion, by its entity type (exhaustive switch, G1). */
function placeOf(input: {
    readonly promotion: {
        readonly entityType: string;
        readonly entityId?: string | null;
        readonly accommodationId?: string | null;
    };
    readonly places: PromotionPlaces;
}): { readonly slug: string; readonly name: string } | undefined {
    const { promotion, places } = input;
    switch (promotion.entityType) {
        case 'venue':
            return promotion.entityId ? places.venues.get(promotion.entityId) : undefined;
        case 'accommodation': {
            const id = promotion.entityId ?? promotion.accommodationId;
            return id ? places.accommodations.get(id) : undefined;
        }
        default:
            // Only accommodation and venue promotions exist; anything else has no place.
            return undefined;
    }
}

/**
 * The promotions first activated in `[from, to)` and still current at `now`, up to
 * `limit`, with their public places, plus the total.
 */
export async function readWeekPromotions(input: {
    readonly from: Date;
    readonly to: Date;
    readonly now: Date;
    readonly limit: number;
}): Promise<{ readonly rows: readonly DigestPromotionRow[]; readonly total: number }> {
    const { items, total } = await ownerPromotionTouristModel.findFirstActivatedBetween(input);
    const accommodationIds = new Set<string>();
    const venueIds = new Set<string>();
    for (const promotion of items) {
        if (promotion.entityType === 'venue') {
            if (promotion.entityId) venueIds.add(promotion.entityId);
        } else {
            const id = promotion.entityId ?? promotion.accommodationId;
            if (id) accommodationIds.add(id);
        }
    }
    const places: PromotionPlaces = await ownerPromotionTouristModel.findPublicPlaces({
        accommodationIds: [...accommodationIds],
        venueIds: [...venueIds]
    });
    return {
        rows: items.map((promotion) => {
            const place = placeOf({ promotion, places });
            return { promotion, place: place ? { slug: place.slug, name: place.name } : null };
        }),
        total
    };
}

/** Users holding at least one live subscription title, with their contact data. */
export async function readVipDigestCandidates(): Promise<{
    readonly recipients: readonly VipDigestRecipient[];
}> {
    const holders = await getDb()
        .selectDistinct({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]));
    const ids = holders.flatMap((row) => (row.userId ? [row.userId] : []));
    if (ids.length === 0) return { recipients: [] };
    const rows = await getDb()
        .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            firstName: users.firstName,
            settings: users.settings
        })
        .from(users)
        .where(and(inArray(users.id, ids), isNull(users.deletedAt)));
    return {
        recipients: rows.map((row) => ({
            id: row.id,
            email: row.email,
            name: row.firstName ?? row.displayName ?? '',
            settings: row.settings
        }))
    };
}
