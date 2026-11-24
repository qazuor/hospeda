/**
 * Tourist-audience scope of a reader of owner promotions (HOS-2590).
 *
 * A promotion's `touristAudience` is `plus` (everybody) or `vip` (VIP tourists
 * only). The scope comes from the reader's TOURIST effective set: `vip` only
 * with `vip_promotions_access`. A role never decides; an anonymous reader and
 * a failed effective-set read both get PLUS only.
 */
import { TouristAudienceEnum, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { isGuestActor } from '../../utils/actor';
import { readEffectiveKeys } from '../../utils/listing-access/user-gate';

/** The catalog key that lets a tourist see VIP-only promotions. */
const VIP_PROMOTIONS_KEY = 'vip_promotions_access';

/**
 * Resolves the audiences of owner promotions an actor may read.
 *
 * @param params - `actor`: the request actor (guest or signed-in user).
 * @returns `['plus', 'vip']` for a VIP tourist, `['plus']` for everyone else.
 */
export async function resolveTouristAudienceScope({
    actor
}: {
    readonly actor: Actor;
}): Promise<readonly TouristAudienceEnum[]> {
    if (isGuestActor(actor)) return [TouristAudienceEnum.PLUS];
    const keys = await readEffectiveKeys({
        userId: actor.id,
        vertical: VerticalEnum.TOURIST,
        keys: [VIP_PROMOTIONS_KEY]
    });
    return keys[VIP_PROMOTIONS_KEY]
        ? [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]
        : [TouristAudienceEnum.PLUS];
}
