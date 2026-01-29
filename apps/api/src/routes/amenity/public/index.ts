/**
 * Public amenity routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app.js';
import { publicGetAmenityByIdRoute } from './getById.js';
import { publicListAmenitiesRoute } from './list.js';

const router = createRouter();

// Register public routes
router.route('/', publicListAmenitiesRoute);
router.route('/', publicGetAmenityByIdRoute);

export { router as publicAmenityRoutes };
