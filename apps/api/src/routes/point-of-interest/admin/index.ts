/**
 * Admin point-of-interest routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchPointsOfInterestRoute } from './batch';
import {
    adminGetPointOfInterestCategoriesRoute,
    adminSetPointOfInterestCategoriesRoute
} from './categories';
import { adminCreatePointOfInterestRoute } from './create';
import { adminDeletePointOfInterestRoute } from './delete';
import {
    adminAddPointOfInterestDestinationRoute,
    adminGetPointOfInterestDestinationsRoute,
    adminRemovePointOfInterestDestinationRoute,
    adminUpdatePointOfInterestDestinationRelationRoute
} from './destinations';
import { adminGetPointOfInterestByIdRoute } from './getById';
import { adminHardDeletePointOfInterestRoute } from './hardDelete';
import { adminListPointsOfInterestRoute } from './list';
import { adminPatchPointOfInterestRoute } from './patch';
import { adminRestorePointOfInterestRoute } from './restore';
import { adminUpdatePointOfInterestRoute } from './update';

const adminRouter = createRouter();

// GET / - List all points of interest (including deleted)
adminRouter.route('/', adminListPointsOfInterestRoute);

// GET /:id - Get point of interest by ID
adminRouter.route('/', adminGetPointOfInterestByIdRoute);

// POST / - Create point of interest
adminRouter.route('/', adminCreatePointOfInterestRoute);

// POST /batch - Batch get points of interest
adminRouter.route('/', adminBatchPointsOfInterestRoute);

// POST /:id/restore - Restore point of interest
adminRouter.route('/', adminRestorePointOfInterestRoute);

// PUT /:id - Update point of interest
adminRouter.route('/', adminUpdatePointOfInterestRoute);

// PATCH /:id - Partial update point of interest
adminRouter.route('/', adminPatchPointOfInterestRoute);

// DELETE /:id - Soft delete point of interest
adminRouter.route('/', adminDeletePointOfInterestRoute);

// DELETE /:id/hard - Hard delete point of interest
adminRouter.route('/', adminHardDeletePointOfInterestRoute);

// GET /:id/destinations - List destinations for a point of interest (HOS-143 T-011)
adminRouter.route('/', adminGetPointOfInterestDestinationsRoute);

// POST /:id/destinations - Add point of interest to a destination (HOS-143 T-011)
adminRouter.route('/', adminAddPointOfInterestDestinationRoute);

// PATCH /:id/destinations/:destinationId - Update the relation kind (HOS-143 T-011)
adminRouter.route('/', adminUpdatePointOfInterestDestinationRelationRoute);

// DELETE /:id/destinations/:destinationId - Remove point of interest from a destination (HOS-143 T-011)
adminRouter.route('/', adminRemovePointOfInterestDestinationRoute);

// GET /:id/categories - List categories assigned to a point of interest (HOS-143 T-012)
adminRouter.route('/', adminGetPointOfInterestCategoriesRoute);

// PUT /:id/categories - Full-replace the category set for a point of interest (HOS-143 T-012)
adminRouter.route('/', adminSetPointOfInterestCategoriesRoute);

export { adminRouter as adminPointOfInterestRoutes };
