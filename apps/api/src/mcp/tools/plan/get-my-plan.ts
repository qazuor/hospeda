/**
 * @file get-my-plan.ts
 * @description Tool `get_my_plan` (HOS-2328, spec HOS-2335 §6.3): what plan
 * the owner has in each vertical, what it includes, and when it renews, ends
 * or the trial runs out.
 *
 * A thin adapter over {@link readMyPlan}, the reader the `get_owner_summary`
 * `subscription` block shares. Behind `BILLING_VIEW_OWN`, the permission of
 * `GET /protected/billing-subscription/`; available to an unverified email like
 * that route (`READ_OWN`). Read only: changing a plan or buying an add-on is
 * done on the linked page (NG-5).
 */

import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { getClock } from '../../../utils/clock';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { readMyPlan } from './my-plan-reader';
import { MY_PLAN_VERTICALS, type MyPlanResult } from './my-plan-types';

/** Input schema of `get_my_plan`. One flat object (C-2). */
export const GetMyPlanInputSchema = z
    .object({
        vertical: z
            .enum(MY_PLAN_VERTICALS)
            .optional()
            .describe(
                'Only this vertical: accommodation, venue (Comer y salir), experience, tourist or partner. Omit it for every vertical.'
            )
    })
    .strict();

/** `get_my_plan`: read-only, `READ_OWN`, requires `BILLING_VIEW_OWN`. */
export const getMyPlanTool = defineTool({
    name: 'get_my_plan',
    title: 'Mi plan y suscripción',
    description:
        'Tells what plan the connected Hospeda user has in each vertical (accommodation, venue, experience, tourist, partner) and what it includes. Returns "items", one per vertical where the user has a live subscription, a permanent grant, a courtesy or a running trial: the plan name (and its catalog version id), the status with its label (ACTIVE, GRACE_PERIOD = payment pending, SUSPENDED, CANCEL_SCHEDULED = cancellation asked for, PAUSED, COURTESY = free months given by Hospeda, PERMANENT_GRANT = permanent free access given by Hospeda, or TRIAL for a free trial), coverageEndsAt (when a courtesy ends; null for a permanent grant, which never ends), nextChargeAt (the next automatic charge), serviceEndsAt (when the service ends after a cancellation), graceEndsAt (deadline of a pending payment), trialDaysLeft, "includes" (the features of the plan as labels and the limits with their values; null when they could not be read right now, never guess them), the recurring add-ons held (an add-on with renewsWithSubscription true has no end date of its own: it renews with the subscription, do not invent a date; one with listingGone true is attached to a listing that no longer exists or is no longer theirs, and may still be charged until it is cancelled), "unattributedAddons" (add-ons no item shows: they belong to no single vertical, or their vertical has no plan any more; with "addonsUrl"), and "actionUrl", the subscription page where any change is made ("addonsUrl" for the add-ons page). "inheritedTouristVip" (present only when the user has Tourist VIP because of a paid plan in another vertical) holds "note", "entitlements" and "limits": these are Tourist VIP benefits, NOT part of the plan. Present them in two separate parts: first what the plan of each vertical includes, then, apart, the Tourist VIP benefits the user has by inheritance, introduced with the "note"; never merge them into one list. A TRIAL item may carry "touristVipOnUpgrade" with a "note": moving to a paid plan of that vertical would also bring Tourist VIP; the trial itself does NOT include Tourist VIP, so never list Tourist VIP benefits as part of the trial. This tool cannot change a plan or buy anything: give the user the link. When "items" is empty the user has no plan: this is not an error, tell them so and give them the "plans" links to choose one.',
    inputSchema: GetMyPlanInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, input, context }): Promise<ToolHandlerResult<MyPlanResult>> => {
        if (!actor.permissions.includes(PermissionEnum.BILLING_VIEW_OWN)) {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Permission denied: billing view permission required'
                }
            };
        }
        const data = await readMyPlan({
            userId: actor.id,
            ...(input.vertical ? { vertical: input.vertical } : {}),
            ...(context.locale ? { locale: context.locale } : {}),
            now: getClock().clock.now()
        });
        return { data };
    }
});
