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
    readonly lifecycleState?: LifecycleStatusEnum | null;
    readonly touristAudience?: TouristAudienceEnum | null;
    readonly firstActivatedAt?: Date | null;
    readonly vipPausedAt?: Date | null;
}

/**
 * The server-managed stamps an update writes (HOS-2589).
 *
 * - `firstActivatedAt` is set ONCE, the first time the promotion is ACTIVE after
 *   the change (§7.7): a later edit or re-activation never moves it, so the weekly
 *   digest never lists an edited promotion as new (AC-19).
 * - `vipPausedAt` (D-8) is cleared when the owner resumes the promotion or turns
 *   it into «Para todos»: from then on it is an ordinary promotion again (AC-37).
 *
 * @param params - `previous` (stored row), `data` (the update) and `now`.
 * @returns Only the stamps that change; an empty object when none does.
 */
export function resolveActivationStamps({
    previous,
    data,
    now
}: {
    readonly previous: ActivationStampSource;
    readonly data: ActivationStampSource;
    readonly now: Date;
}): { firstActivatedAt?: Date; vipPausedAt?: null } {
    const out: { firstActivatedAt?: Date; vipPausedAt?: null } = {};
    const nextState = data.lifecycleState ?? previous.lifecycleState;
    if (!previous.firstActivatedAt && nextState === LifecycleStatusEnum.ACTIVE) {
        out.firstActivatedAt = now;
    }
    const resumed =
        data.lifecycleState === LifecycleStatusEnum.ACTIVE ||
        data.touristAudience === TouristAudienceEnum.PLUS;
    if (previous.vipPausedAt && resumed) out.vipPausedAt = null;
    return out;
}
