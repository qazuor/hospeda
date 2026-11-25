/**
 * Who reads a promotion list, in the terms of the free / VIP model (HOS-2589).
 *
 * - `isVip`: `vip_promotions_access` on the reader's TOURIST effective set (own
 *   `tourist-vip` title or `inherits_tourist_vip` inheritance). A role never
 *   decides (G6). A guest is never VIP.
 * - `freeQuota`: the X of the model, the limit `max_free_visible_promotions`. A
 *   signed-in reader gets it from the effective set (which resolves the floor plan
 *   for a free tourist); a guest, who has no effective set, from the current
 *   version of the TOURIST floor plan. Never a code constant (G7, M-4).
 *
 * Fail-closed (AC-11): a failed read yields `isVip: false, freeQuota: 0`, so every
 * promotion is locked and nothing leaks. Every failure is logged as a warning.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, getDb, planCatalogModel, plans } from '@repo/db';
import { LimitKeyEnum, type TouristAudienceEnum, VerticalEnum } from '@repo/schemas';
import { type Actor, resolvePromotionVisibility } from '@repo/service-core';
import { isGuestActor } from '../../utils/actor';
import { readEffectiveKeys, readEffectiveLimit } from '../../utils/listing-access/user-gate';
import { apiLogger } from '../../utils/logger';

/** The catalog key that makes a tourist VIP for promotions. */
const VIP_PROMOTIONS_KEY = 'vip_promotions_access';

/** What the resolver needs to know about the reader. */
export interface TouristPromotionAccess {
    readonly isVip: boolean;
    readonly freeQuota: number;
}

/**
 * Reads one limit of the current version of a vertical's floor plan.
 *
 * @param params - `vertical` and limit `key`.
 * @returns The value, or 0 when the plan, its version or the row is missing.
 */
export async function readFloorPlanLimit({
    vertical,
    key
}: {
    readonly vertical: VerticalEnum;
    readonly key: string;
}): Promise<number> {
    const [floor] = await getDb()
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.vertical, vertical), eq(plans.role, 'floor')))
        .limit(1);
    if (!floor) return 0;
    const version = await planCatalogModel.findCurrentPlanVersion({ planId: floor.id });
    if (!version) return 0;
    const effects = await planCatalogModel.findPlanVersionEffects({ id: version.id });
    return effects.limits.find((limit) => limit.key === key)?.value ?? 0;
}

/**
 * The free quota a guest gets: the TOURIST floor plan's value, 0 on any failure.
 *
 * @returns The quota.
 */
export async function readGuestFreeQuota(): Promise<number> {
    try {
        return await readFloorPlanLimit({
            vertical: VerticalEnum.TOURIST,
            key: LimitKeyEnum.MAX_FREE_VISIBLE_PROMOTIONS
        });
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'HOS-2589: floor plan free-promotions quota lookup failed (fail-closed)'
        );
        return 0;
    }
}

/**
 * Resolves the reader's access to promotions.
 *
 * @param params - `actor`: the request actor (guest or signed-in user).
 * @returns `{ isVip, freeQuota }`, fail-closed.
 */
export async function resolveTouristPromotionAccess({
    actor
}: {
    readonly actor: Actor;
}): Promise<TouristPromotionAccess> {
    if (isGuestActor(actor)) return { isVip: false, freeQuota: await readGuestFreeQuota() };
    const keys = await readEffectiveKeys({
        userId: actor.id,
        vertical: VerticalEnum.TOURIST,
        keys: [VIP_PROMOTIONS_KEY]
    });
    if (keys[VIP_PROMOTIONS_KEY]) return { isVip: true, freeQuota: 0 };
    const freeQuota = await readEffectiveLimit({
        userId: actor.id,
        vertical: VerticalEnum.TOURIST,
        key: LimitKeyEnum.MAX_FREE_VISIBLE_PROMOTIONS
    });
    if (freeQuota === 0) {
        apiLogger.warn(
            { userId: actor.id },
            'HOS-2589: free-promotions quota is 0 for a non-VIP reader (failed read or missing catalog row); every promotion is locked'
        );
    }
    return { isVip: false, freeQuota };
}

/**
 * The guest policy of the legacy full-content reads (`/public/owner-promotions`,
 * `/public/venues/{id}/promotions`, HOS-2589 AC-10): a non-VIP reader gets only
 * what the resolver would show in full, so the quota is never a URL away. Locked
 * promotions are dropped, not serialized, because these reads have no locked shape.
 *
 * @param params - `actor` and the `items` the read would return (each with `id` and
 *   `touristAudience`).
 * @returns The items the reader may see in full, in their original order.
 */
export async function keepOnlyFreelyVisible<
    T extends {
        readonly id: string;
        readonly touristAudience: TouristAudienceEnum | `${TouristAudienceEnum}`;
    }
>({ actor, items }: { readonly actor: Actor; readonly items: readonly T[] }): Promise<T[]> {
    const { isVip, freeQuota } = await resolveTouristPromotionAccess({ actor });
    if (isVip) return [...items];
    const visible = new Set(
        resolvePromotionVisibility({ promotions: items, isVip, freeQuota, seed: randomUUID() })
            .filter((decision) => decision.kind === 'visible')
            .map((decision) => decision.promotion.id)
    );
    return items.filter((item) => visible.has(item.id));
}
