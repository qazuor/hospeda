/**
 * Admin commerce routes barrel (SPEC-239 T-047)
 * Mounts under /api/v1/admin/commerce.
 */
import { createRouter } from '../../../utils/create-app';
import { adminListLeadsRoute } from './list-leads';
import { adminMarkHandledRoute } from './mark-handled';

const router = createRouter();

// GET  /leads          — list leads with filters
router.route('/leads', adminListLeadsRoute);
// POST /leads/:id/handle — approve / reject a lead
router.route('/leads', adminMarkHandledRoute);

/** Admin commerce routes: GET /leads, POST /leads/:id/handle */
export const adminCommerceRoutes = router;
