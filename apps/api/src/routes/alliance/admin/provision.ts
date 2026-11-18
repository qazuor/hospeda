/**
 * Admin alliance lead provisioning retry endpoint (HOS-2339)
 *
 * Re-runs `host_trades` provisioning for an already-approved `service_provider`
 * lead, and nothing else. It never re-sends the approval-decision email. It DOES
 * mint and send a claim invite when it newly creates the listing for a lead with
 * no applicant user (HOS-599), because that listing would otherwise be ownerless.
 *
 * Error contract (apps/api/docs/error-contract.md): 401, 403, 400, 404, then the
 * business rules: 422 `NOT_A_SERVICE_PROVIDER` and 409 `LEAD_NOT_APPROVED`.
 * A skipped provisioning is an outcome (200), not an error.
 *
 * @module routes/alliance/admin/provision
 */

import {
    AllianceLeadWithProvisioningSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { AllianceLeadService } from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    createAllianceApprovalClaimInvitePort,
    createAllianceDecisionNotifyPort
} from '../../../lib/alliance-ports';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

// Same wiring as `mark-handled.ts`. The decision notifier is wired for parity
// but `provisionListing` never calls it.
const allianceLeadService = new AllianceLeadService(
    { logger: apiLogger },
    createAllianceApprovalClaimInvitePort(env.HOSPEDA_SITE_URL),
    createAllianceDecisionNotifyPort()
);

/** Business-rule refusals the retry answers, keyed by the service `reason`. */
const BUSINESS_REFUSALS: Readonly<Record<string, { code: string; status: 409 | 422 }>> = {
    NOT_A_SERVICE_PROVIDER: { code: ServiceErrorCode.VALIDATION_ERROR, status: 422 },
    LEAD_NOT_APPROVED: { code: ServiceErrorCode.ALREADY_EXISTS, status: 409 }
};

/**
 * POST /api/v1/admin/alliance/leads/:id/provision
 *
 * Permission: ALLIANCE_LEAD_MANAGE. Idempotent: an already-provisioned lead
 * answers 200 with `reason: 'already-provisioned'` and the existing id.
 */
export const adminProvisionAllianceLeadRoute = createAdminRoute({
    method: 'post',
    path: '/:id/provision',
    successStatusCode: 200,
    summary: 'Retry provisioning of a service provider lead (admin)',
    description:
        'Re-runs the directory-listing provisioning of an approved service_provider ' +
        'alliance lead. Does not re-send the approval email; sends a claim invite only ' +
        'when it newly creates the listing for a lead with no applicant user. A skipped ' +
        'provisioning answers 200 with provisioning.provisioned = false and a reason. ' +
        'Requires ALLIANCE_LEAD_MANAGE.',
    tags: ['Alliance'],
    requiredPermissions: [PermissionEnum.ALLIANCE_LEAD_MANAGE],
    requestParams: {
        id: z.string().uuid({ message: 'Lead ID must be a valid UUID' })
    },
    responseSchema: AllianceLeadWithProvisioningSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await allianceLeadService.provisionListing({
            actor,
            id: params.id as string
        });

        if (result.error) {
            const refusal =
                result.error.reason === undefined
                    ? undefined
                    : BUSINESS_REFUSALS[result.error.reason];
            if (refusal) {
                return createErrorResponse(
                    {
                        code: refusal.code,
                        message: result.error.message,
                        details: { reason: result.error.reason },
                        reason: result.error.reason
                    },
                    ctx,
                    refusal.status
                );
            }
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        return result.data!;
    }
});
