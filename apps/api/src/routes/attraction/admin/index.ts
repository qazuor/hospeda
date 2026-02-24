/**
 * Admin attraction routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchAttractionsRoute } from './batch';
import { adminCreateAttractionRoute } from './create';
import { adminDeleteAttractionRoute } from './delete';
import { adminGetAttractionByIdRoute } from './getById';
import { adminHardDeleteAttractionRoute } from './hardDelete';
import { adminListAttractionsRoute } from './list';
import { adminPatchAttractionRoute } from './patch';
import { adminRestoreAttractionRoute } from './restore';
import { adminUpdateAttractionRoute } from './update';

const adminRouter = createRouter();

// GET / - List all attractions (including deleted)
adminRouter.route('/', adminListAttractionsRoute);

// GET /:id - Get attraction by ID
adminRouter.route('/', adminGetAttractionByIdRoute);

// POST / - Create attraction
adminRouter.route('/', adminCreateAttractionRoute);

// POST /batch - Batch get attractions
adminRouter.route('/', adminBatchAttractionsRoute);

// POST /:id/restore - Restore attraction
adminRouter.route('/', adminRestoreAttractionRoute);

// PUT /:id - Update attraction
adminRouter.route('/', adminUpdateAttractionRoute);

// PATCH /:id - Partial update attraction
adminRouter.route('/', adminPatchAttractionRoute);

// DELETE /:id - Soft delete attraction
adminRouter.route('/', adminDeleteAttractionRoute);

// DELETE /:id/hard - Hard delete attraction
adminRouter.route('/', adminHardDeleteAttractionRoute);

export { adminRouter as adminAttractionRoutes };
