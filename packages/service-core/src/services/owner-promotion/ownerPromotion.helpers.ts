/**
 * Helper utilities for OwnerPromotionService.
 */

import type { OwnerPromotionModel } from '@repo/db';
import { LifecycleStatusEnum, TouristAudienceEnum } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * Generates a unique slug for an owner promotion based on its title.
 *
 * Owner promotions use a plain `title` (not an i18n object), so the slug is
 * derived directly from it. Uniqueness is enforced against the database: if a
 * generated slug already exists, `createUniqueSlug` appends a unique suffix.
 *
 * @param title - The promotion title to derive the slug from.
 * @param model - The OwnerPromotionModel (or mock) used to check slug uniqueness.
 * @returns A promise resolving to a unique slug string.
 */
export async function generateOwnerPromotionSlug(
    title: string,
    model: Pick<OwnerPromotionModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(title, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}

/** The fields of a promotion {@link resolveActivationStamps} reads. */
interface ActivationStampSource {
    readonly lifecycleState?: LifecycleStatusEnum | `${LifecycleStatusEnum}` | null;
    readonly touristAudience?: TouristAudienceEnum | `${TouristAudienceEnum}` | null;
    readonly firstActivatedAt?: Date | null;
    readonly vipPausedAt?: Date | null;
}

/**
 * Whether an update resumes a «Solo VIP» promotion that was paused on the loss of
 * `vip_only_promotions` (D-8) while it stays `vip`. That is only allowed after the
 * caller verified the owner holds the key again (AC-37, AC-38).
 *
 * @param params - `previous` (stored row) and `data` (the update).
 * @returns `true` for a paused `vip` promotion that would be ACTIVE and `vip` again.
 */
export function isVipResumption({
    previous,
    data
}: {
    readonly previous: ActivationStampSource;
    readonly data: ActivationStampSource;
}): boolean {
    if (!previous.vipPausedAt) return false;
    const nextState = data.lifecycleState ?? previous.lifecycleState;
    const nextAudience = data.touristAudience ?? previous.touristAudience;
    return nextState === LifecycleStatusEnum.ACTIVE && nextAudience === TouristAudienceEnum.VIP;
}

/**
 * The server-managed stamps an update writes (HOS-2589).
 *
 * - `firstActivatedAt` is set ONCE, the first time the promotion is ACTIVE after
 *   the change (§7.7): a later edit or re-activation never moves it, so the weekly
 *   digest never lists an edited promotion as new (AC-19).
 * - `vipPausedAt` (D-8) is cleared when the promotion becomes «Para todos», or when
 *   it is resumed as «Solo VIP» AND `vipOnlyVerified` (the caller checked that the
 *   owner holds `vip_only_promotions` again). Re-activating alone never clears it.
 *
 * @param params - `previous` (stored row), `data` (the update), `now` and
 *   `vipOnlyVerified`.
 * @returns Only the stamps that change; an empty object when none does.
 */
export function resolveActivationStamps({
    previous,
    data,
    now,
    vipOnlyVerified = false
}: {
    readonly previous: ActivationStampSource;
    readonly data: ActivationStampSource;
    readonly now: Date;
    readonly vipOnlyVerified?: boolean;
}): { firstActivatedAt?: Date; vipPausedAt?: null } {
    const out: { firstActivatedAt?: Date; vipPausedAt?: null } = {};
    const nextState = data.lifecycleState ?? previous.lifecycleState;
    if (!previous.firstActivatedAt && nextState === LifecycleStatusEnum.ACTIVE) {
        out.firstActivatedAt = now;
    }
    if (previous.vipPausedAt) {
        const nextAudience = data.touristAudience ?? previous.touristAudience;
        const becomesPlus = nextAudience === TouristAudienceEnum.PLUS;
        const verifiedResume = vipOnlyVerified && isVipResumption({ previous, data });
        if (becomesPlus || verifiedResume) out.vipPausedAt = null;
    }
    return out;
}
