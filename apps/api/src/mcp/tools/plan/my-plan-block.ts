/**
 * @file my-plan-block.ts
 * @description The owner's plan as a block other tools embed (HOS-2328,
 * HOS-2184 phase B AC-16): the `subscription` block of `get_owner_summary`,
 * the `plan` block of `get_listing_stats` and the `plans` block of
 * `list_my_listings`. One reader for all of them, {@link readMyPlan}, so the
 * block equals the `get_my_plan` item (AC-C15b).
 *
 * The caller checks `BILLING_VIEW_OWN` first, like `get_my_plan` does, and
 * leaves the block out without it.
 */

import type { PortalLocale } from '@repo/portal-routes';
import { apiLogger } from '../../../utils/logger';
import { readMyPlan } from './my-plan-reader';
import type {
    MyPlanAddon,
    MyPlanInheritedTouristVip,
    MyPlanItem,
    MyPlanVertical
} from './my-plan-types';

/** What {@link readSubscriptionBlock} answers. */
export interface SubscriptionBlock {
    /** The `get_my_plan` items keyed by vertical; a vertical with no plan is absent. */
    readonly subscription?: Partial<Record<MyPlanVertical, MyPlanItem>>;
    /** `get_my_plan`'s add-ons that no item shows. */
    readonly unattributedAddons?: readonly MyPlanAddon[];
    /** `get_my_plan`'s inherited Tourist VIP block. */
    readonly inheritedTouristVip?: MyPlanInheritedTouristVip;
    /** Present when the plan could not be read. */
    readonly unavailable?: true;
}

/**
 * The `get_my_plan` items keyed by vertical, from the shared reader (AC-C15b).
 * A failed plan read never fails the embedding tool: the block is answered
 * `unavailable`, logged, and the rest of the tool still answers.
 *
 * @param args.userId - The owner
 * @param args.locale - Locale of labels and links
 * @param args.now - The caller's clock instant
 * @param args.verticals - Only these verticals; all of them when omitted
 * @param args.tool - The embedding tool, for the log line (required: the
 *   line must name the tool that lost its block)
 * @returns The block, or `{ unavailable: true }`
 */
export async function readSubscriptionBlock(args: {
    readonly userId: string;
    readonly locale: PortalLocale | undefined;
    readonly now: Date;
    readonly verticals?: readonly MyPlanVertical[];
    readonly tool: string;
}): Promise<SubscriptionBlock> {
    try {
        const plan = await readMyPlan({
            userId: args.userId,
            ...(args.verticals ? { verticals: args.verticals } : {}),
            ...(args.locale ? { locale: args.locale } : {}),
            now: args.now
        });
        return {
            subscription: Object.fromEntries(plan.items.map((item) => [item.vertical, item])),
            ...(plan.unattributedAddons ? { unattributedAddons: plan.unattributedAddons } : {}),
            ...(plan.inheritedTouristVip ? { inheritedTouristVip: plan.inheritedTouristVip } : {})
        };
    } catch (error) {
        apiLogger.warn(
            {
                userId: args.userId,
                error: error instanceof Error ? error.message : String(error)
            },
            `${args.tool}: plan read failed; subscription block omitted`
        );
        return { unavailable: true };
    }
}
