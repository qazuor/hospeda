import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import {
    type LivePermanentGrantPlan,
    readLivePermanentGrantPlan
} from '../grant/permanent-grant-live-plan';

/**
 * Rejects a checkout for the plan the person already holds through a live
 * permanent grant (HOS-2665): nothing would be gained by paying for it. A
 * different plan of the same vertical (an upgrade) stays allowed, as does any
 * plan of a vertical the grant does not anchor.
 *
 * It runs after the 422 plan checks and after `TOURIST_VIP_INHERITED`, the same
 * order the pricing situation reads (inheritance, then grant). Only the public
 * checkout asks for it; the team's card subscription (action 6) does not.
 *
 * Accepted race (HOS-2665): S1 reads «no grant», S13 then commits a grant, and
 * S1 creates the pending authorization. Re-reading inside the pending insert's
 * transaction would only narrow the window under READ COMMITTED, not close it
 * (S13 takes no lock S1 also takes). The cost is one extra paid checkout the
 * person started themselves; the pricing situation then reads `GRANTED`.
 *
 * @param input.userId - The buyer
 * @param input.choice - The selected billing choice's vertical and plan
 * @param input.readGrantPlan - Grant reader port; defaults to the real DB reader
 * @throws ServiceError `ALREADY_EXISTS` / `PLAN_ALREADY_GRANTED` (409)
 */
export async function assertPlanNotAlreadyGranted(input: {
    readonly userId: string;
    /** The S1 billing choice: its vertical and the plan it belongs to. */
    readonly choice: { readonly vertical: string; readonly planId: string };
    readonly readGrantPlan?: (args: {
        readonly userId: string;
        readonly vertical: string;
    }) => Promise<{ readonly plan: LivePermanentGrantPlan | null }>;
}): Promise<void> {
    const read = input.readGrantPlan ?? readLivePermanentGrantPlan;
    const { plan } = await read({ userId: input.userId, vertical: input.choice.vertical });
    if (plan && plan.planId === input.choice.planId) {
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'This plan is already granted to you',
            undefined,
            'PLAN_ALREADY_GRANTED'
        );
    }
}
