/**
 * Public sponsorship package routes
 * Read-only access, no authentication required
 */
import { createRouter } from '../../../utils/create-app';
import { sponsorshipPackageGetByIdRoute } from './getById';
import { sponsorshipPackageListRoute } from './list';

const router = createRouter();

// GET / - List sponsorship packages
router.route('/', sponsorshipPackageListRoute);

// GET /:id - Get sponsorship package by ID
router.route('/', sponsorshipPackageGetByIdRoute);

export { router as publicSponsorshipPackageRoutes };
