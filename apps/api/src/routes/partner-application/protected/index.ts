import { createRouter } from '../../../utils/create-app';
import { protectedPartnerClaimCheckRoute } from './check.js';
import { protectedPartnerClaimRoute } from './claim.js';

const router = createRouter();
router.route('/check', protectedPartnerClaimCheckRoute);
router.route('/', protectedPartnerClaimRoute);

/** Protected Partner claim routes. */
export const protectedPartnerClaimRoutes = router;
