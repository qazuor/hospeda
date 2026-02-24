/**
 * Admin amenity routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app.js';
import { adminBatchAmenitiesRoute } from './batch.js';
import { adminCreateAmenityRoute } from './create.js';
import { adminDeleteAmenityRoute } from './delete.js';
import { adminGetAmenityByIdRoute } from './getById.js';
import { adminHardDeleteAmenityRoute } from './hardDelete.js';
import { adminListAmenitiesRoute } from './list.js';
import { adminPatchAmenityRoute } from './patch.js';
import { adminRestoreAmenityRoute } from './restore.js';
import { adminUpdateAmenityRoute } from './update.js';

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
