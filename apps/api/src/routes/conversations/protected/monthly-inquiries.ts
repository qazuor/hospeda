/**
 * GET /api/v1/protected/conversations/me/monthly-inquiries
 *
 * Returns monthly inquiry counts for the authenticated host's own
 * accommodations across the requested window (default 6 months).
 *
 * Used by HOST card I — "Tendencia mensual" — to render a continuous
 * bar/line time-series. The series is gap-filled server-side so the chart
 * never receives sparse data.
 *
 * @module routes/conversations/protected/monthly-inquiries
 * @see SPEC-155 HOST card I
 */

import { EntitlementKey } from '@repo/billing';
import { PermissionEnum } from '@repo/schemas';
import { ConversationService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
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

const HostMonthlyInquiriesSchema = z.object({
    months: z.array(
        z.object({
            month: z.string(),
            count: z.number().int().min(0)
        })
    )
});

const queryParamsSchema = z.object({
    months: z.coerce.number().int().min(1).max(24).default(6).optional()
});

/**
 * GET /me/monthly-inquiries
 *
 * Aggregated monthly inquiry counts for the authenticated host. Requires
 * `CONVERSATION_VIEW_OWN`. Returns 200 with a zero-filled series even when
 * the host has zero conversations.
 */
export const hostConversationMonthlyInquiriesRoute = createProtectedRoute({
    method: 'get',
    path: '/me/monthly-inquiries',
    summary: 'Get host monthly inquiry trend',
    description:
        'Returns a continuous month-by-month inquiry count series for the ' +
        'authenticated host (gap-filled with zeroes). Requires ' +
        'CONVERSATION_VIEW_OWN permission.',
    tags: ['Conversations'],
    requiredPermissions: [PermissionEnum.CONVERSATION_VIEW_OWN],
    requestQuery: queryParamsSchema.shape,
    responseSchema: HostMonthlyInquiriesSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const months = (query as { months?: number } | undefined)?.months ?? 6;

        const result = await conversationService.getHostMonthlyInquiries(actor, { months });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { months: result.data ?? [] };
    },
    options: {
        // SPEC-145 T-006: VIEW_BASIC_STATS gate — monthly-inquiries trend KPI is
        // a basic stats feature granted on owner-basico (and above) and
        // complex-basico (and above). Tourists never see this route.
        middlewares: [requireEntitlement(EntitlementKey.VIEW_BASIC_STATS)],
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
