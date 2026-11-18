/**
 * Admin alliance routes barrel (HOS-277)
 * Mounts under /api/v1/admin/alliance.
 */
import { createRouter } from '../../../utils/create-app';
import { adminApproveAndProvisionPartnerRoute } from './approve-and-provision-partner';
import { adminListAllianceLeadsRoute } from './list-leads';
import { adminMarkAllianceLeadHandledRoute } from './mark-handled';
import { adminProvisionAllianceLeadRoute } from './provision';

const router = createRouter();

// GET  /leads                                    — list leads with kind/status filters
router.route('/leads', adminListAllianceLeadsRoute);
// POST /leads/:id/mark-handled                   — approve / reject a lead
router.route('/leads', adminMarkAllianceLeadHandledRoute);
// POST /leads/:id/approve-and-provision-partner  — approve + materialize the partner
router.route('/leads', adminApproveAndProvisionPartnerRoute);
// POST /leads/:id/provision                      — retry provider provisioning (HOS-2339)
router.route('/leads', adminProvisionAllianceLeadRoute);

/**
 * Admin alliance routes:
 * - GET  /leads                                   (list leads)
 * - POST /leads/:id/mark-handled                  (approve / reject)
 * - POST /leads/:id/approve-and-provision-partner (approve + provision a partner)
 * - POST /leads/:id/provision                     (retry provider provisioning)
 */
export const adminAllianceRoutes = router;
