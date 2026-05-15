/**
 * Admin sponsorship level routes
 * Requires admin role and appropriate permissions
 */
import { createRouter } from '../../../utils/create-app';
import { createSponsorshipLevelRoute } from './create';
import { deleteSponsorshipLevelRoute } from './delete';
import { adminListSponsorshipLevelsRoute } from './list';
import { updateSponsorshipLevelRoute } from './update';

const router = createRouter();

// GET / - List sponsorship levels (SPEC-117 follow-up #2)
router.route('/', adminListSponsorshipLevelsRoute);

// POST / - Create sponsorship level
router.route('/', createSponsorshipLevelRoute);

// PUT /:id - Update sponsorship level
router.route('/', updateSponsorshipLevelRoute);

// DELETE /:id - Soft delete sponsorship level
router.route('/', deleteSponsorshipLevelRoute);

export { router as adminSponsorshipLevelRoutes };
