/**
 * Admin revoke host-trade endpoint (HOS-278 R-4).
 *
 * ```
 * POST /api/v1/admin/host-trades/:id/revoke
 * ```
 *
 * Takes a listing off the directory while KEEPING the row, and records who
 * decided, when, and why. It is an action-POST rather than a DELETE because
 * Hono's DELETE handlers receive no body and the reason is required — a
 * DELETE with a body would have it silently discarded.
 *
 * Distinct from `DELETE /{id}` (soft-delete): a soft-deleted listing vanishes
 * from admin queries too, and the admins who revoked one are exactly who still
 * needs to see it.
 *
 * @module routes/host-trade/admin/revoke
 */

import { HostTradeAdminSchema, HostTradeIdSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createHostTradeRevokeNotifyPort } from '../../../lib/host-trade-ports';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// The notify port is injected here rather than imported by the service, so
// `@repo/service-core` stays free of the notification transport. Passing the
// default models explicitly is the cost of the port being the fourth argument.
const hostTradeService = new HostTradeService(
    { logger: apiLogger },
    undefined,
    undefined,
    createHostTradeRevokeNotifyPort()
);

/**
 * Body for a revocation.
 *
 * `reason` is required and non-empty. The whole point of keeping the row is
 * that "why is this provider no longer listed?" has an answer; accepting a
 * blank one would leave the same gap deleting would.
 */
const RevokeHostTradeBodySchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.hostTrade.revokeReason.required' })
        .max(1000, { message: 'zodError.hostTrade.revokeReason.max' })
});

/**
 * POST /api/v1/admin/host-trades/:id/revoke
 * Revoke a host-trade listing — Admin endpoint.
 */
export const adminRevokeHostTradeRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/revoke',
    summary: 'Revoke host-trade listing',
    description:
        'Makes a host-trade listing invisible while keeping the row, recording the acting admin, the timestamp and the reason. Unlike soft-delete, a revoked listing stays visible to admins. Re-revoking is a no-op and never overwrites the original reason. Requires HOST_TRADE_DELETE permission.',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_DELETE],
    requestParams: {
        id: HostTradeIdSchema
    },
    requestBody: RevokeHostTradeBodySchema,
    responseSchema: HostTradeAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { reason } = body as z.infer<typeof RevokeHostTradeBodySchema>;

        const result = await hostTradeService.revoke(actor, { id, reason });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data?.trade;
    }
});
