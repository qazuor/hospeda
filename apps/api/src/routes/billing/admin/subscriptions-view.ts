/**
 * Admin billing subscriptions — Hospeda list view
 *
 * Routes:
 * - GET /api/v1/admin/billing/subscriptions — paginated, enriched subscription list
 *
 * ONLY the collection path is defined here. `GET /subscriptions/:id`,
 * `POST /subscriptions/:id/cancel`, `/change-plan`, `/extend-trial`, ... stay
 * with the `@qazuor/qzpay-hono` admin tier; this router is mounted BEFORE that
 * tier so it wins the collection collision and falls through for everything
 * else. Adding a second path to this file would silently take that path away
 * from qzpay too — don't.
 *
 * @module routes/billing/admin/subscriptions-view
 */

import {
    AdminSubscriptionViewSchema,
    AdminSubscriptionViewSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { listSubscriptions } from '../../../services/admin-billing-view.service';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/billing/subscriptions
 *
 * Returns subscriptions joined to the subscribing Hospeda user and their plan,
 * with the recurring amount derived from the plan price for the billing
 * interval. `status` is normalised (qzpay's `canceled` is served as `cancelled`)
 * and the raw stored value travels alongside it as `rawStatus`.
 */
export const adminListSubscriptionsViewRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List billing subscriptions (admin)',
    description:
        'Returns paginated billing subscriptions enriched with the subscriber, the plan, and the recurring amount. Statuses use the normalised Hospeda vocabulary; a status filter matches every spelling physically stored in the column, so filtering by `cancelled` also returns rows stored as qzpay `canceled`.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: AdminSubscriptionViewSearchSchema.shape,
    responseSchema: AdminSubscriptionViewSchema,
    handler: async (_c, _params, _body, query) => {
        const filters = AdminSubscriptionViewSearchSchema.parse(query ?? {});

        apiLogger.debug({ filters }, 'Admin listing billing subscriptions (Hospeda view)');

        const { items, pagination } = await listSubscriptions(filters);

        return { items: [...items], pagination };
    }
});

/**
 * Admin subscriptions view router.
 * Mounted under /api/v1/admin/billing/subscriptions by admin/index.ts.
 */
export const adminSubscriptionsViewRouter = createRouter();

adminSubscriptionsViewRouter.route('/', adminListSubscriptionsViewRoute);
