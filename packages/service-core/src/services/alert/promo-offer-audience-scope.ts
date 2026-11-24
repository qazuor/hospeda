/**
 * Tourist-audience scope of the price-alert promo-offer digest (HOS-2592).
 *
 * An owner promotion's `touristAudience` is `plus` (everybody) or `vip` (VIP
 * tourists only). The digest used to send every match to every subscriber, so
 * a free tourist received a VIP-only promotion by email. The scope is decided
 * per recipient through an injected port the caller wires to the recipient's
 * TOURIST effective set (`vip_promotions_access`); this module never reads a
 * role. Every uncertain case fails closed to `plus` only.
 */
import type { OwnerPromotion } from '@repo/schemas';
import { TouristAudienceEnum } from '@repo/schemas';
import type { PromoOfferMatch } from './promo-offer-evaluator.service';

/**
 * Port that resolves the owner-promotion audiences one recipient may receive.
 *
 * @param params - `userId`: the digest recipient.
 * @returns The audiences the recipient may receive (`plus`, plus `vip` for a VIP).
 */
export type ResolvePromoOfferAudienceScope = (params: {
    readonly userId: string;
}) => Promise<readonly TouristAudienceEnum[]>;

/** The scope every recipient gets when the port is absent or fails. */
const PLUS_ONLY_SCOPE: readonly TouristAudienceEnum[] = [TouristAudienceEnum.PLUS];

/**
 * Fallback port: plus only for everybody, so a caller that forgets to wire the
 * real port leaks nothing.
 *
 * @returns `['plus']`.
 */
export const plusOnlyPromoOfferAudienceScope: ResolvePromoOfferAudienceScope = async () =>
    PLUS_ONLY_SCOPE;

/**
 * Whether a promotion is for everybody. Anything other than an explicit `plus`
 * (a `vip` promotion, or a missing/unknown audience) counts as restricted.
 */
function isOpenToEveryone(promotion: OwnerPromotion): boolean {
    return promotion.touristAudience === TouristAudienceEnum.PLUS;
}

/** Reads one recipient's scope, plus only when the port throws. */
async function readScope({
    userId,
    resolveAudienceScope
}: {
    readonly userId: string;
    readonly resolveAudienceScope: ResolvePromoOfferAudienceScope;
}): Promise<readonly TouristAudienceEnum[]> {
    try {
        return await resolveAudienceScope({ userId });
    } catch {
        return PLUS_ONLY_SCOPE;
    }
}

/**
 * Drops, per recipient, the matches whose promotion is not for everybody unless
 * that recipient's scope includes `vip`. The port is called only for recipients
 * holding a restricted match. A recipient left with no match is removed from
 * the map (never an empty-array entry), so nothing is sent to them.
 *
 * @param params - `matchesByUser`: the evaluator's raw result; `promotions`: the
 *   qualifying promotions the matches came from; `resolveAudienceScope`: the
 *   per-recipient port.
 * @returns A new map holding only the matches each recipient may receive.
 */
export async function applyPromoOfferAudienceScope({
    matchesByUser,
    promotions,
    resolveAudienceScope
}: {
    readonly matchesByUser: ReadonlyMap<string, PromoOfferMatch[]>;
    readonly promotions: readonly OwnerPromotion[];
    readonly resolveAudienceScope: ResolvePromoOfferAudienceScope;
}): Promise<Map<string, PromoOfferMatch[]>> {
    const restrictedPromotionIds = new Set(
        promotions
            .filter((promotion) => !isOpenToEveryone(promotion))
            .map((promotion) => promotion.id)
    );

    const scoped = new Map<string, PromoOfferMatch[]>();
    for (const [userId, matches] of matchesByUser) {
        if (!matches.some((match) => restrictedPromotionIds.has(match.promotionId))) {
            scoped.set(userId, matches);
            continue;
        }
        const scope = await readScope({ userId, resolveAudienceScope });
        const allowed = scope.includes(TouristAudienceEnum.VIP)
            ? matches
            : matches.filter((match) => !restrictedPromotionIds.has(match.promotionId));
        if (allowed.length > 0) {
            scoped.set(userId, allowed);
        }
    }
    return scoped;
}
