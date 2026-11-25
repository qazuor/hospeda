/**
 * Author-side gate of «Solo VIP» promotions (HOS-2589 D-4, AC-26, AC-38).
 *
 * An owner may only publish, keep editing live, or resume a promotion whose
 * audience is `vip` while their own vertical's effective set grants
 * `vip_only_promotions`. A role never decides (G6). Enforced here, server-side,
 * on every owner write door (accommodation create/PUT/PATCH and venue
 * create/PUT/PATCH); the locked radio in the form is only a hint.
 *
 * What does NOT need the key, so an owner who lost it can still put things away:
 * a body that keeps the promotion out of ACTIVE without switching it to `vip`
 * (a pause, an archive, an edit of a paused promotion), and anything whose
 * resulting audience is `plus` («resume as Para todos», AC-37).
 *
 * Refusal: 403 `ENTITLEMENT_REQUIRED` with `entitlementKey: 'vip_only_promotions'`
 * (`apps/api/docs/error-contract.md`, the same pair `enforceUserGate` answers for
 * `create_promotions`). A failed effective-set read refuses (fail-closed).
 */
import {
    EntitlementKeyEnum,
    LifecycleStatusEnum,
    TouristAudienceEnum,
    type VerticalEnum
} from '@repo/schemas';
import { enforceUserGate } from '../../utils/listing-access/user-gate';

/** The stored fields of a promotion the gate reads. */
interface ExistingPromotionAudience {
    readonly touristAudience?: string | null;
    readonly lifecycleState?: string | null;
}

/**
 * Whether a write needs `vip_only_promotions`.
 *
 * @param params - `body` (the validated request) and `existing` (absent on create).
 * @returns `true` when the resulting promotion is `vip` and the write publishes it,
 *   keeps it live, or switches it to `vip`.
 */
export function requiresVipOnlyEntitlement({
    body,
    existing
}: {
    readonly body: Record<string, unknown>;
    readonly existing?: ExistingPromotionAudience;
}): boolean {
    const audience = (body.touristAudience as string | undefined) ?? existing?.touristAudience;
    if (audience !== TouristAudienceEnum.VIP) return false;
    if (!existing) return true;
    if (body.touristAudience === TouristAudienceEnum.VIP) return true;
    const state = (body.lifecycleState as string | undefined) ?? existing.lifecycleState;
    return state === LifecycleStatusEnum.ACTIVE;
}

/**
 * Refuses the write when it needs `vip_only_promotions` and the owner lacks it.
 *
 * @param params - `userId` (the owner), `vertical` (the promotion's own vertical),
 *   `body` and `existing`.
 * @returns `true` when the key was checked and held (the service may then clear a
 *   VIP pause), `false` when the write did not need it.
 * @throws {ServiceError} ENTITLEMENT_REQUIRED when the key is missing.
 */
export async function enforceVipOnlyPromotionGate({
    userId,
    vertical,
    body,
    existing
}: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly body: Record<string, unknown>;
    readonly existing?: ExistingPromotionAudience;
}): Promise<boolean> {
    if (!requiresVipOnlyEntitlement({ body, existing })) return false;
    await enforceUserGate({
        userId,
        vertical,
        keys: [EntitlementKeyEnum.VIP_ONLY_PROMOTIONS]
    });
    return true;
}
