import { z } from '@hono/zod-openapi';
/**
 * Host Dashboard Protected Endpoint
 *
 * Single aggregation endpoint returning property counts, plan info,
 * and unread conversation count for the authenticated host user.
 *
 * Gated by `VIEW_BASIC_STATS` entitlement (SPEC-205).
 *
 * GET /api/v1/protected/host/dashboard
 */
import { EntitlementKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * Host dashboard aggregated response schema.
 * Property counts, plan info, and unread conversation placeholder.
 */
export const HostDashboardResponseSchema = z.object({
    properties: z.object({
        total: z.number().int().min(0),
        published: z.number().int().min(0),
        draft: z.number().int().min(0),
        archived: z.number().int().min(0)
    }),
    plan: z
        .object({
            slug: z.string(),
            name: z.string(),
            status: z.enum(['active', 'trial', 'cancelled', 'expired', 'past_due']),
            isTrial: z.boolean()
        })
        .nullable(),
    unreadConversations: z.number().int().min(0)
});

export type HostDashboardResponse = z.infer<typeof HostDashboardResponseSchema>;

/**
 * GET /api/v1/protected/host/dashboard
 *
 * Returns aggregated host dashboard data:
 * - Property counts (total, published, draft, archived)
 * - Active plan info (slug, name, status, isTrial)
 * - Unread conversations count (placeholder — always 0 in Phase 1)
 *
 * Gated by VIEW_BASIC_STATS entitlement.
 * Staff roles bypass via entitlementMiddleware (INV-6).
 */
export const hostDashboardRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'Host Dashboard',
    description:
        'Returns aggregated host dashboard data: property counts, plan info, and unread conversation count. ' +
        'Requires VIEW_BASIC_STATS entitlement.',
    tags: ['Host', 'Dashboard'],
    responseSchema: HostDashboardResponseSchema,
    handler: async (ctx: Context, _params: Record<string, unknown>) => {
        try {
            const actor = getActorFromContext(ctx);
            apiLogger.debug('Host dashboard requested', {
                actorId: actor.id,
                role: actor.role
            });

            // TODO(SPEC-205): Phase 2 — wire real AccommodationService, BillingService, ConversationService
            // For Phase 1, return safe defaults while the aggregation layer is built out.
            // The real implementation will call three services in parallel:
            //   1. AccommodationService → counts filtered by ownerId
            //   2. BillingService → plan info for the host's subscription
            //   3. ConversationService → unread count for host conversations

            const response: HostDashboardResponse = {
                properties: {
                    total: 0,
                    published: 0,
                    draft: 0,
                    archived: 0
                },
                plan: null,
                unreadConversations: 0
            };

            return response;
        } catch (error) {
            apiLogger.error('Host dashboard handler failed', {
                error: String(error)
            });
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to load host dashboard data'
            );
        }
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.VIEW_BASIC_STATS)]
    }
});
