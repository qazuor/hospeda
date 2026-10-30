import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { CatalogVersionNotFoundError } from '@repo/verticals';
import { permanentGrantRejection } from './permanent-grant-authorization.js';

/**
 * Validate each anchor floor with verticals' plan policy, in input order.
 * Billing does not resolve the current version or inspect catalog ranks; the
 * database's composite foreign keys enforce that each floor belongs to its plan.
 * This is the single check intended for reuse by the B9a step 3b tool.
 *
 * @param input Anchors to validate and the verticals plan policy port.
 * @throws A typed permanent-grant rejection for missing or non-current versions;
 *   all other policy errors propagate unchanged.
 */
export async function assertAnchorFloorsAcceptable(input: {
    readonly anchors: readonly {
        readonly vertical: string;
        readonly planId: string;
        readonly floorPlanVersionId: string;
    }[];
    readonly planPolicy: VerticalsForBilling['planPolicy'];
}): Promise<void> {
    for (const { floorPlanVersionId } of input.anchors) {
        let policy: Awaited<ReturnType<VerticalsForBilling['planPolicy']>>;
        try {
            policy = await input.planPolicy({ planVersionId: floorPlanVersionId });
        } catch (error) {
            if (error instanceof CatalogVersionNotFoundError)
                throw permanentGrantRejection({
                    reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND',
                    message: 'Permanent grant reference not found'
                });
            throw error;
        }
        if (!policy.current)
            throw permanentGrantRejection({
                reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT',
                message: 'The floor version is not the current version of its plan'
            });
    }
}
