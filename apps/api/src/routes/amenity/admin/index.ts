/**
 * Admin amenity routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchAmenitiesRoute } from './batch';
import { adminCreateAmenityRoute } from './create';
import { adminDeleteAmenityRoute } from './delete';
import { adminGetAmenityByIdRoute } from './getById';
import { adminHardDeleteAmenityRoute } from './hardDelete';
import { adminListAmenitiesRoute } from './list';
import { adminPatchAmenityRoute } from './patch';
import { adminRestoreAmenityRoute } from './restore';
import { adminUpdateAmenityRoute } from './update';

const router = createRouter();

// GET / - List all amenities (including deleted)
router.route('/', adminListAmenitiesRoute);

// GET /:id - Get amenity by ID
router.route('/', adminGetAmenityByIdRoute);

// POST / - Create amenity
router.route('/', adminCreateAmenityRoute);

// POST /batch - Batch get amenities
router.route('/', adminBatchAmenitiesRoute);

// POST /:id/restore - Restore amenity
router.route('/', adminRestoreAmenityRoute);

// PUT /:id - Update amenity
router.route('/', adminUpdateAmenityRoute);

// PATCH /:id - Partial update amenity
router.route('/', adminPatchAmenityRoute);

// DELETE /:id - Soft delete amenity
router.route('/', adminDeleteAmenityRoute);

// DELETE /:id/hard - Hard delete amenity
router.route('/', adminHardDeleteAmenityRoute);

export { router as adminAmenityRoutes };
