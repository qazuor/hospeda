/**
 * Shared plumbing of the per-actor promotion reads (HOS-2589 §7.5).
 *
 * Every per-actor read answers a different body to each reader (VIP or not, a
 * different seeded pick), so it is never cacheable: `Cache-Control: private,
 * no-store` plus `Vary: Cookie` (AC-22), and its path never joins
 * `PUBLIC_CACHE_ENDPOINTS` or `PRIVATE_CACHE_ENDPOINTS`.
 */
import { randomUUID } from 'node:crypto';
import { accommodationModel, ownerPromotionModel, ownerPromotionTouristModel } from '@repo/db';
import {
    type OwnerPromotion,
    OwnerPromotionEntityTypeEnum,
    PromotionSeedSchema,
    ServiceErrorCode,
    TouristAudienceEnum
} from '@repo/schemas';
import {
    type Actor,
    buildPromotionVisibilityItems,
    type PromotionPlaces,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { resolveTouristPromotionAccess } from '../tourist-promotion-access';

/** Upper bound of promotions one detail page resolves. */
const MAX_PROMOTIONS_PER_PLACE = 100;

/**
 * Marks a response as per-actor and uncacheable (AC-22).
 *
 * @param params - `ctx`: the Hono context.
 */
export function markPerActorResponse({ ctx }: { readonly ctx: Context }): void {
    ctx.header('Cache-Control', 'private, no-store');
    ctx.header('Vary', 'Cookie');
}

/**
 * The seed a read uses: the client's when well-formed, a fresh one otherwise (a
 * missing or malformed seed still answers correctly, only without stability).
 *
 * @param params - `raw`: the `seed` query value.
 * @returns An opaque seed.
 */
export function resolveRequestSeed({ raw }: { readonly raw: unknown }): string {
    const parsed = PromotionSeedSchema.safeParse(raw);
    return parsed.success ? parsed.data : randomUUID();
}

/** One public place and its current promotions, every audience. */
interface PlacePromotions {
    readonly promotions: OwnerPromotion[];
    readonly places: PromotionPlaces;
}

/**
 * Loads a PUBLISHED place's current promotions. A place that does not exist, is not
 * published or is deleted answers 404, the same as the public detail page.
 *
 * @param params - `entityType` and `entityId`.
 * @returns The promotions and the place map the item builder reads.
 * @throws {ServiceError} NOT_FOUND.
 */
export async function loadPlacePromotions({
    entityType,
    entityId
}: {
    readonly entityType: OwnerPromotionEntityTypeEnum;
    readonly entityId: string;
}): Promise<PlacePromotions> {
    if (entityType === OwnerPromotionEntityTypeEnum.VENUE) {
        const places = await ownerPromotionTouristModel.findPublicPlaces({
            accommodationIds: [],
            venueIds: [entityId]
        });
        if (!places.venues.has(entityId)) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Venue not found');
        }
        const promotions = await ownerPromotionTouristModel.findActiveForVenueAllAudiences({
            venueId: entityId
        });
        return { promotions, places };
    }
    const places = await ownerPromotionTouristModel.findPublicPlaces({
        accommodationIds: [entityId],
        venueIds: []
    });
    const place = places.accommodations.get(entityId);
    if (!place) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
    const accommodation = await accommodationModel.findById(entityId);
    if (!accommodation) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
    }
    const { items } = await ownerPromotionModel.findActiveForAccommodation(
        {
            accommodationId: entityId,
            ownerId: accommodation.ownerId,
            touristAudiences: [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]
        },
        { page: 1, pageSize: MAX_PROMOTIONS_PER_PLACE }
    );
    // An owner-wide promotion is shown on each of the owner's accommodation pages, so
    // on this page it hangs on THIS accommodation.
    const placed = items.map((promotion) =>
        promotion.entityId || promotion.accommodationId
            ? promotion
            : ({ ...promotion, entityId } as OwnerPromotion)
    );
    return { promotions: placed, places };
}

/**
 * Resolves one batch of promotions for the request's reader.
 *
 * @param params - `actor`, `promotions`, `places` and the `seed`.
 * @returns The items and the reader meta.
 */
export async function resolveForReader({
    actor,
    promotions,
    places,
    seed,
    lockGuest
}: {
    readonly actor: Actor;
    readonly promotions: readonly OwnerPromotion[];
    readonly places: PromotionPlaces;
    readonly seed: string;
    readonly lockGuest?: boolean;
}) {
    const { isVip, freeQuota } = await resolveTouristPromotionAccess({ actor, lockGuest });
    const items = buildPromotionVisibilityItems({ promotions, places, isVip, freeQuota, seed });
    return { items, meta: { isVip, freeQuota } };
}
