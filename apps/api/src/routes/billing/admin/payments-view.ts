/**
 * Admin billing payments — Hospeda list view
 *
 * Routes:
 * - GET /api/v1/admin/billing/payments — paginated, enriched payment list
 *
 * ONLY the collection path is defined here. `GET /payments/:id` and
 * `POST /payments/:id/refund` stay with the `@qazuor/qzpay-hono` admin tier;
 * this router is mounted BEFORE that tier so it wins the collection collision
 * and falls through for everything else. Adding a second path to this file
 * would silently take that path away from qzpay too — don't.
 *
 * @module routes/billing/admin/payments-view
 */

import {
    AdminPaymentViewSchema,
    AdminPaymentViewSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { listPayments } from '../../../services/admin-billing-view.service';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/billing/payments
 *
 * Returns payments joined to the paying Hospeda user and the plan behind them,
 * with every amount in integer centavos and `isRefundable` decided server-side.
 */
export const adminListPaymentsViewRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List billing payments (admin)',
    description:
        'Returns paginated billing payments enriched with the paying user and the plan behind the payment. Statuses use the normalised Hospeda vocabulary and status filters match every spelling physically stored in the column.',
    tags: ['Billing', 'Payments'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: AdminPaymentViewSearchSchema.shape,
    responseSchema: AdminPaymentViewSchema,
    handler: async (_c, _params, _body, query) => {
        const filters = AdminPaymentViewSearchSchema.parse(query ?? {});

        apiLogger.debug({ filters }, 'Admin listing billing payments (Hospeda view)');

        const { items, pagination } = await listPayments(filters);

        return { items: [...items], pagination };
    }
});

/**
 * Admin payments view router.
 * Mounted under /api/v1/admin/billing/payments by admin/index.ts.
 */
export const adminPaymentsViewRouter = createRouter();

adminPaymentsViewRouter.route('/', adminListPaymentsViewRoute);
