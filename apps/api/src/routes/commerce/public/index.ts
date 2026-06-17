/**
 * Public commerce routes barrel (SPEC-239 T-047)
 * Mounts under /api/v1/public/commerce.
 */
import { createRouter } from '../../../utils/create-app';
import { publicCreateLeadRoute } from './create-lead';

const router = createRouter();
router.route('/leads', publicCreateLeadRoute);

/** Public commerce routes: POST /leads */
export const publicCommerceRoutes = router;
