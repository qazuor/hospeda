import { createRouter } from '../../../utils/create-app.js';
import { adminAnchorPermanentGrantRoute } from './anchor.js';
import { adminPreviewPermanentGrantAnchorRoute } from './anchor-preview.js';
import { adminGrantPermanentGrantRoute } from './grant.js';
import { adminPreviewPermanentGrantRoute } from './grant-preview.js';
import { adminLivePermanentGrantRoute } from './live.js';
import {
    adminPermanentGrantRevocationPreviewRoute,
    adminRevokePermanentGrantRoute
} from './revocation.js';

const router = createRouter();
router.route('/', adminPreviewPermanentGrantRoute);
router.route('/', adminLivePermanentGrantRoute);
router.route('/', adminGrantPermanentGrantRoute);
router.route('/', adminAnchorPermanentGrantRoute);
router.route('/', adminRevokePermanentGrantRoute);
router.route('/', adminPreviewPermanentGrantAnchorRoute);
router.route('/', adminPermanentGrantRevocationPreviewRoute);

/** Admin permanent-grant routes mounted at `/api/v1/admin/billing-permanent-grants`. */
export { router as adminBillingPermanentGrantRoutes };
