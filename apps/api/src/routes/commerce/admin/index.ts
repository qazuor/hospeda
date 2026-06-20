/**
 * Admin commerce routes barrel (SPEC-239 T-047 / T-050)
 * Mounts under /api/v1/admin/commerce.
 */
import { createRouter } from '../../../utils/create-app';
import { adminApproveAndProvisionRoute } from './approve-and-provision';
import { adminListLeadsRoute } from './list-leads';
import { adminMarkHandledRoute } from './mark-handled';
import { adminProvisionOwnerRoute } from './provision-owner';
import { adminStartCommerceSubscriptionRoute } from './start-subscription';

const router = createRouter();

// GET  /leads                   — list leads with filters
router.route('/leads', adminListLeadsRoute);
// POST /leads/:id/handle        — approve / reject a lead
router.route('/leads', adminMarkHandledRoute);
// POST /leads/:id/provision-owner — provision a COMMERCE_OWNER account (T-050)
// Registered before start-subscription to avoid route shadowing (distinct base paths).
router.route('/leads', adminProvisionOwnerRoute);
// POST /leads/:id/approve-and-provision — approve + provision in one action (SPEC-249 T-018)
router.route('/leads', adminApproveAndProvisionRoute);
// POST /listings/:entityType/:entityId/start-subscription — provision a commerce sub (T-048)
router.route('/', adminStartCommerceSubscriptionRoute);

/**
 * Admin commerce routes:
 * - GET  /leads                            (list leads)
 * - POST /leads/:id/handle                 (approve / reject)
 * - POST /leads/:id/provision-owner        (create COMMERCE_OWNER account)
 * - POST /leads/:id/approve-and-provision  (approve + provision, SPEC-249 Part D)
 * - POST /listings/:entityType/:entityId/start-subscription
 */
export const adminCommerceRoutes = router;
