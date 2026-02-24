/**
 * Public sponsorship level routes
 * Read-only access, no authentication required
 */
import { createRouter } from '../../../utils/create-app';
import { sponsorshipLevelGetByIdRoute } from './getById';
import { sponsorshipLevelListRoute } from './list';

const router = createRouter();

// GET / - List sponsorship levels
router.route('/', sponsorshipLevelListRoute);

// GET /:id - Get sponsorship level by ID
router.route('/', sponsorshipLevelGetByIdRoute);

export { router as publicSponsorshipLevelRoutes };
