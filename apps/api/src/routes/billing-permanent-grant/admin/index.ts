import { createRouter } from '../../../utils/create-app.js';
import { adminAnchorPermanentGrantRoute } from './anchor.js';
import { adminGrantPermanentGrantRoute } from './grant.js';
import { adminRevokePermanentGrantRoute } from './revocation.js';

const router = createRouter();
router.route('/', adminGrantPermanentGrantRoute);
router.route('/', adminAnchorPermanentGrantRoute);
router.route('/', adminRevokePermanentGrantRoute);

/** Admin permanent-grant routes mounted at `/api/v1/admin/billing-permanent-grants`. */
export { router as adminBillingPermanentGrantRoutes };
