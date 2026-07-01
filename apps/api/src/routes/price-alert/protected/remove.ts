/**
 * DELETE /api/v1/protected/price-alerts/:alertId
 *
 * Cancels (soft-deletes) a price-alert subscription owned by the
 * authenticated actor. Ungated — cancelling an alert never consumes the
 * `MAX_ACTIVE_ALERTS` limit, so users at the cap must still be able to free
 * up slots (mirrors the `search-history`/`user-bookmark` deletion policy).
 *
 * @route DELETE /api/v1/protected/price-alerts/:alertId
 * @module routes/price-alert/protected/remove
 */
import { AlertSubscriptionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const alertSubscriptionService = new AlertSubscriptionService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/price-alerts/:alertId
 * Cancel one price-alert subscription (owner-scoped).
 *
 * `AlertSubscriptionService.softDelete()` returns `{ count: number }` on
 * success, which is a non-empty object — the route factory's auto-204 logic
 * (`createProtectedRoute` → `createCRUDRoute`) only fires when the handler
 * returns `undefined`/`null`/`{}`. The handler discards `result.data` and
 * returns `undefined` explicitly so the response is a real 204 No Content.
 */
export const deletePriceAlertRoute = createProtectedRoute({
    method: 'delete',
    path: '/{alertId}',
    summary: 'Cancel a price-alert subscription',
    description:
        'Soft-deletes (cancels) a single price-alert subscription. The authenticated actor must own the subscription. Returns 204 No Content on success.',
    tags: ['Price Alerts'],
    requestParams: { alertId: z.string().uuid() },
    responseSchema: z.null(),
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const alertId = params.alertId as string;

        const result = await alertSubscriptionService.softDelete(actor, alertId);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return undefined;
    }
});
