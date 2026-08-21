/**
 * Admin commerce routes barrel (SPEC-239 T-050)
 * Mounts under /api/v1/admin/commerce.
 *
 * HOS-695 (release C) removed the leads sub-tree (`GET /leads`, `POST
 * /leads/:id/handle`) — the commerce lead-intake funnel no longer accepts new
 * submissions (its public form and admin provisioning flow were retired by
 * HOS-693), and its remaining three rows were smoke-test fixtures the owner
 * confirmed have nothing worth reviewing. `commerce_leads` itself was dropped
 * in the same release.
 */
import { createRouter } from '../../../utils/create-app';
import { adminStartCommerceSubscriptionRoute } from './start-subscription';

const router = createRouter();

// POST /listings/:entityType/:entityId/start-subscription — provision a commerce sub (T-048)
router.route('/', adminStartCommerceSubscriptionRoute);

/**
 * Admin commerce routes:
 * - POST /listings/:entityType/:entityId/start-subscription
 */
export const adminCommerceRoutes = router;
