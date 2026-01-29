/**
 * Admin amenity routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app.js';
import { adminListAmenitiesRoute } from './list.js';
import { adminRestoreAmenityRoute } from './restore.js';

const router = createRouter();

// Register admin routes
router.route('/', adminListAmenitiesRoute);
router.route('/', adminRestoreAmenityRoute);

export { router as adminAmenityRoutes };
