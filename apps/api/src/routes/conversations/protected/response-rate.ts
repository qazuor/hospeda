/**
 * GET /api/v1/protected/conversations/me/response-rate
 *
 * Returns conversation response-rate KPIs for the authenticated host.
 *
 * Scoped strictly to `actor.id` — the ownerId is never derived from a query
 * param to prevent hosts from peeking at other hosts' metrics.
 *
 * Response shape: `{ responseRatePct: number, avgResponseTimeMinutes: number | null }`
 *
 * @module routes/conversations/protected/response-rate
 * @see SPEC-155 T-006
 */

import { EntitlementKey } from '@repo/billing';
import { HostConversationResponseRateSchema, PermissionEnum } from '@repo/schemas';
import { ConversationService, ServiceError } from '@repo/service-core';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const conversationService = new ConversationService(
    { logger: apiLogger },
    {
        authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
        siteUrl: env.HOSPEDA_SITE_URL
    }
);

/**
 * GET /me/response-rate
 *
 * Aggregated KPIs for the authenticated host:
 *  - `responseRatePct`:        percentage of conversations with ≥1 owner reply.
 *  - `avgResponseTimeMinutes`: average first-reply time in minutes (null if no
 *                              replies have been sent yet).
 *
 * Requires `CONVERSATION_VIEW_OWN` permission (standard host-tier).
 * Returns 200 even when the host has zero conversations (zeroed values).
 */
export const hostConversationResponseRateRoute = createProtectedRoute({
    method: 'get',
    path: '/me/response-rate',
    summary: 'Get host conversation response rate',
    description:
        'Returns the response rate percentage and average response time in minutes ' +
        "for the authenticated host's conversations. Scoped strictly to the " +
        "host's own accommodations. Requires CONVERSATION_VIEW_OWN permission.",
    tags: ['Conversations'],
    requiredPermissions: [PermissionEnum.CONVERSATION_VIEW_OWN],
    responseSchema: HostConversationResponseRateSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await conversationService.getHostResponseRate(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-006: VIEW_BASIC_STATS gate — response-rate KPI is a basic
        // stats feature granted on owner-basico (and above) and complex-basico
        // (and above). Tourists never see this route.
        middlewares: [requireEntitlement(EntitlementKey.VIEW_BASIC_STATS)],
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
