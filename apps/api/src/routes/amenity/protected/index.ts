/**
 * Protected amenity routes
 * Requires authentication and appropriate permissions
 */
import { createRouter } from '../../../utils/create-app.js';
import { protectedCreateAmenityRoute } from './create.js';
import { protectedPatchAmenityRoute } from './patch.js';
import { protectedSoftDeleteAmenityRoute } from './softDelete.js';
import { protectedUpdateAmenityRoute } from './update.js';

const router = createRouter();

// Register protected routes
router.route('/', protectedCreateAmenityRoute);
router.route('/', protectedUpdateAmenityRoute);
router.route('/', protectedPatchAmenityRoute);
router.route('/', protectedSoftDeleteAmenityRoute);

export { router as protectedAmenityRoutes };
