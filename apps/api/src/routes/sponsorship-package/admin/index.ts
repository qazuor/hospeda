/**
 * Admin sponsorship package routes
 * Requires admin role and appropriate permissions
 */
import { createRouter } from '../../../utils/create-app';
import { createSponsorshipPackageRoute } from './create';
import { deleteSponsorshipPackageRoute } from './delete';
import { updateSponsorshipPackageRoute } from './update';

const router = createRouter();

// POST / - Create sponsorship package
router.route('/', createSponsorshipPackageRoute);

// PUT /:id - Update sponsorship package
router.route('/', updateSponsorshipPackageRoute);

// DELETE /:id - Soft delete sponsorship package
router.route('/', deleteSponsorshipPackageRoute);

export { router as adminSponsorshipPackageRoutes };
