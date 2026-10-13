/**
 * GET /api/v1/protected/price-alerts
 *
 * Returns the authenticated actor's own price-alert subscriptions.
 * Ungated — listing does not consume the `MAX_ACTIVE_ALERTS` limit.
 *
 * @route GET /api/v1/protected/price-alerts
 * @module routes/price-alert/protected/list
 */
import { PriceAlertListItemSchema, PublicationStatusEnum } from '@repo/schemas';
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
 * match {@link PriceAlertListItemSchema}.
 *
 * `closedBecauseListingGone` (HOS-1492, V8a row 27) is `true` when the alert
 * is closed AND its listing reached `PURGED`. It never says why the listing
 * stopped existing: that belongs to the owner (row 20). The relation already
 * carries the listing's `publicationStatus`, so no extra read happens.
 */
export const listPriceAlertsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List price-alert subscriptions',
    description:
        "Returns the authenticated actor's own price-alert subscriptions, including a denormalized accommodation name for display.",
    tags: ['Price Alerts'],
    responseSchema: z.object({
        items: z.array(PriceAlertListItemSchema),
        total: z.number()
    }),
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await alertSubscriptionService.list(actor, {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const items = (result.data?.items ?? []).map((item) => {
            const withRelation = item as typeof item & {
                accommodation?: { name?: string; publicationStatus?: string | null };
            };
            return {
                ...item,
                accommodationName: withRelation.accommodation?.name ?? '',
                closedBecauseListingGone:
                    item.isActive === false &&
                    withRelation.accommodation?.publicationStatus === PublicationStatusEnum.PURGED
            };
        });

        return {
            items,
            total: result.data?.total ?? 0
        };
    }
});
