/**
 * GET /api/v1/protected/price-alerts
 *
 * Returns the authenticated actor's own price-alert subscriptions.
 * Ungated — listing does not consume the `MAX_ACTIVE_ALERTS` limit.
 *
 * @route GET /api/v1/protected/price-alerts
 * @module routes/price-alert/protected/list
 */
import { PriceAlertResponseSchema } from '@repo/schemas';
import { AlertSubscriptionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const alertSubscriptionService = new AlertSubscriptionService({ logger: apiLogger });

/**
 * GET /api/v1/protected/price-alerts
 * List the actor's own price-alert subscriptions.
 *
 * `AlertSubscriptionService.list()` is scoped to the caller (`_beforeList`
 * forces `userId: actor.id`) and eager-loads the `accommodation` relation
 * (`getDefaultListRelations()`), so each item carries a runtime
 * `.accommodation` object this route flattens into `accommodationName` to
 * match {@link PriceAlertResponseSchema}.
 */
export const listPriceAlertsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List price-alert subscriptions',
    description:
        "Returns the authenticated actor's own price-alert subscriptions, including a denormalized accommodation name for display.",
    tags: ['Price Alerts'],
    responseSchema: z.object({
        items: z.array(PriceAlertResponseSchema),
        total: z.number()
    }),
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await alertSubscriptionService.list(actor, {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const items = (result.data?.items ?? []).map((item) => {
            const withRelation = item as typeof item & { accommodation?: { name?: string } };
            return {
                ...item,
                accommodationName: withRelation.accommodation?.name ?? ''
            };
        });

        return {
            items,
            total: result.data?.total ?? 0
        };
    }
});
