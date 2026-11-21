/**
 * @file my-plan-tourist-vip.ts
 * @description The two Tourist VIP parts of `readMyPlan` (HOS-2398). Owner plan
 * versions declare only their own capabilities; the tourist ones arrive by
 * inheritance (`inherits_tourist_vip`), so they are shown apart from the plan:
 * - `inheritedTouristVip`: what the owner holds by inheritance, from the cached
 *   TOURIST effective set;
 * - `touristVipOnUpgrade`: on a TRIAL item, the line saying a paid plan would
 *   bring it, from the sellable catalog the plans pages read. The trial itself
 *   does not inherit it (owner decision, 2026-11-20).
 *
 * Both degrade to absent, logged, when their read fails: never invented.
 */

import type { Locale } from '@repo/i18n';
import { VerticalEnum } from '@repo/schemas';
import { readSellablePlanCatalog } from '../../../routes/plan-catalog/public/read-sellable-catalog';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { apiLogger } from '../../../utils/logger';
import { label, labelView } from './my-plan-labels';
import type {
    MyPlanInheritedTouristVip,
    MyPlanTouristVipOnUpgrade,
    MyPlanVertical
} from './my-plan-types';

/**
 * Tourist VIP inherited from a paid plan (HOS-2398), read from the cached
 * TOURIST effective set exactly like any vertical's includes. `undefined` when
 * the set says it is not inherited, or when it cannot be read (logged; the
 * block is never invented).
 */
export async function readInheritedTouristVip(input: {
    readonly userId: string;
    readonly locale: Locale;
}): Promise<MyPlanInheritedTouristVip | undefined> {
    const { userId, locale } = input;
    const vertical = VerticalEnum.TOURIST;
    try {
        const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
        if (effective.inheritsTouristVip !== true) {
            return undefined;
        }
        return {
            note: label({
                key: 'billing.vip.inheritedFromPaidPlan',
                locale,
                fallback: 'Tourist VIP'
            }),
            ...labelView(toEffectiveSetView({ effective, userId, vertical }), locale)
        };
    } catch (error) {
        apiLogger.warn(
            { userId, vertical, error: error instanceof Error ? error.message : String(error) },
            'get_my_plan: inherited Tourist VIP could not be read'
        );
        return undefined;
    }
}

/** Verticals with a public sellable catalog, the ones a trial can move to a paid plan in. */
const SELLABLE_CATALOG_VERTICALS = ['accommodation', 'venue', 'experience', 'tourist'] as const;

/**
 * The line of a TRIAL item when moving to a paid plan also brings Tourist VIP
 * (HOS-2398): every sellable paid version of the vertical has
 * `inherits_tourist_vip`, read from the same sellable catalog the plans pages
 * show (`readSellablePlanCatalog`). `undefined` when they do not, when the
 * vertical sells nothing, or when the catalog cannot be read (logged).
 */
export async function readTouristVipOnUpgrade(input: {
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
}): Promise<MyPlanTouristVipOnUpgrade | undefined> {
    const { vertical, locale } = input;
    const sellableVertical = SELLABLE_CATALOG_VERTICALS.find((v) => v === vertical);
    if (!sellableVertical) {
        return undefined;
    }
    try {
        const { plans } = await readSellablePlanCatalog({ vertical: sellableVertical });
        if (plans.length === 0 || !plans.every((plan) => plan.inheritsTouristVip === true)) {
            return undefined;
        }
        return {
            note: label({ key: 'billing.vip.onUpgradeToPaidPlan', locale, fallback: 'Tourist VIP' })
        };
    } catch (error) {
        apiLogger.warn(
            { vertical, error: error instanceof Error ? error.message : String(error) },
            'get_my_plan: sellable catalog could not be read for the trial Tourist VIP line'
        );
        return undefined;
    }
}
