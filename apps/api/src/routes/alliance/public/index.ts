/**
 * Public alliance routes barrel (HOS-277)
 * Mounts under /api/v1/public/alliance.
 */
import { createRouter } from '../../../utils/create-app';
import { publicCreateAllianceLeadRoute } from './create-lead';

const router = createRouter();
router.route('/leads', publicCreateAllianceLeadRoute);

/** Public alliance routes: POST /leads */
export const publicAllianceRoutes = router;
