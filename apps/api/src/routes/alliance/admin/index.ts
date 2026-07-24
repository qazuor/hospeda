/**
 * Admin alliance routes barrel (HOS-277)
 * Mounts under /api/v1/admin/alliance.
 */
import { createRouter } from '../../../utils/create-app';
import { adminListAllianceLeadsRoute } from './list-leads';
import { adminMarkAllianceLeadHandledRoute } from './mark-handled';

const router = createRouter();

// GET  /leads                       — list leads with kind/status filters
router.route('/leads', adminListAllianceLeadsRoute);
// POST /leads/:id/mark-handled      — approve / reject a lead
router.route('/leads', adminMarkAllianceLeadHandledRoute);

/**
 * Admin alliance routes:
 * - GET  /leads                     (list leads)
 * - POST /leads/:id/mark-handled    (approve / reject)
 */
export const adminAllianceRoutes = router;
