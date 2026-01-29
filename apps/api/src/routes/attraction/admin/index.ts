/**
 * Admin attraction routes
 * Requires admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchAttractionsRoute } from './batch';
import { adminHardDeleteAttractionRoute } from './hardDelete';
import { adminListAttractionsRoute } from './list';
import { adminRestoreAttractionRoute } from './restore';

const adminRouter = createRouter();

// Register admin routes
adminRouter.route('/', adminListAttractionsRoute);
adminRouter.route('/', adminBatchAttractionsRoute);
adminRouter.route('/', adminHardDeleteAttractionRoute);
adminRouter.route('/', adminRestoreAttractionRoute);

export { adminRouter as adminAttractionRoutes };
