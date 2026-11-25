/**
 * Builds the `visible | locked` items of a per-actor promotion read (HOS-2589 §7.4).
 *
 * Pure. The resolver decides; this module only serializes, and it is the one
 * place that decides what a locked item may carry (D-5, G-4): the discount value
 * and type, the audience, the entity type and a placeholder name. The real title,
 * description, conditions, ids, slug, owner and place are never copied into a
 * locked item, whatever the caller passes in.
 */
import {
    type OwnerPromotion,
    OwnerPromotionEntityTypeEnum,
    type PromotionPlace,
    type PromotionVisibilityItem,
    toPromotionWindow
} from '@repo/schemas';
import { buildPlaceholderName, resolvePromotionVisibility } from './ownerPromotion.quota-resolver';

/** Public places by id, per vertical, as the API resolved them. */
export interface PromotionPlaces {
    readonly accommodations: ReadonlyMap<string, PromotionPlace>;
    readonly venues: ReadonlyMap<string, PromotionPlace>;
}

/** Input of {@link buildPromotionVisibilityItems}. RO-RO. */
export interface BuildPromotionVisibilityItemsInput {
    readonly promotions: readonly OwnerPromotion[];
    readonly places: PromotionPlaces;
    readonly isVip: boolean;
    readonly freeQuota: number;
    readonly seed: string;
}

/**
 * The public place a promotion hangs on, or `null` (owner-wide, or not public).
 *
 * @param params - The `promotion` and the resolved `places`.
 * @returns The place, or `null`.
 */
export function placeOfPromotion({
    promotion,
    places
}: {
    readonly promotion: OwnerPromotion;
    readonly places: PromotionPlaces;
}): PromotionPlace | null {
    if (promotion.entityType === OwnerPromotionEntityTypeEnum.VENUE) {
        return promotion.entityId ? (places.venues.get(promotion.entityId) ?? null) : null;
    }
    const id = promotion.entityId ?? promotion.accommodationId ?? null;
    return id ? (places.accommodations.get(id) ?? null) : null;
}

/**
 * Resolves and serializes one page of promotions for a reader.
 *
 * @param input - See {@link BuildPromotionVisibilityItemsInput}.
 * @returns The items, visible first, then locked `plus`, then locked `vip`.
 */
export function buildPromotionVisibilityItems({
    promotions,
    places,
    isVip,
    freeQuota,
    seed
}: BuildPromotionVisibilityItemsInput): PromotionVisibilityItem[] {
    const decisions = resolvePromotionVisibility({ promotions, isVip, freeQuota, seed });
    let lockedIndex = 0;
    return decisions.map(({ kind, promotion }) => {
        const place = placeOfPromotion({ promotion, places });
        if (kind === 'locked') {
            const index = lockedIndex;
            lockedIndex += 1;
            return {
                kind: 'locked',
                key: `l${index}`,
                audience: promotion.touristAudience,
                entityType: promotion.entityType,
                discountType: promotion.discountType,
                discountValue: promotion.discountValue,
                placeholderName: buildPlaceholderName({
                    realName: place?.name ?? null,
                    seed,
                    index
                })
            };
        }
        return {
            kind: 'visible',
            audience: promotion.touristAudience,
            entityType: promotion.entityType,
            id: promotion.id,
            slug: promotion.slug,
            title: promotion.title,
            description: promotion.description ?? null,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            minNights: promotion.minNights ?? null,
            validFrom: promotion.validFrom,
            validUntil: promotion.validUntil ?? null,
            window: toPromotionWindow(promotion),
            place: place ? { id: place.id, slug: place.slug, name: place.name } : null
        };
    });
}
