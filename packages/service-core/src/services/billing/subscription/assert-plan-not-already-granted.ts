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
