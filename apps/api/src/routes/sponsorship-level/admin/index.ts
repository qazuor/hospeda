/**
 * Admin sponsorship level routes
 * Requires admin role and appropriate permissions
 */
import { createRouter } from '../../../utils/create-app';
import { createSponsorshipLevelRoute } from './create';
import { deleteSponsorshipLevelRoute } from './delete';
import { updateSponsorshipLevelRoute } from './update';

const router = createRouter();

// POST / - Create sponsorship level
router.route('/', createSponsorshipLevelRoute);

// PUT /:id - Update sponsorship level
router.route('/', updateSponsorshipLevelRoute);

// DELETE /:id - Soft delete sponsorship level
router.route('/', deleteSponsorshipLevelRoute);

export { router as adminSponsorshipLevelRoutes };
