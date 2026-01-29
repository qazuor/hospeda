/**
 * Protected attraction routes
 * Requires authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateAttractionRoute } from './create';
import { protectedPatchAttractionRoute } from './patch';
import { protectedSoftDeleteAttractionRoute } from './softDelete';
import { protectedUpdateAttractionRoute } from './update';

const protectedRouter = createRouter();

// Register protected routes
protectedRouter.route('/', protectedCreateAttractionRoute);
protectedRouter.route('/', protectedUpdateAttractionRoute);
protectedRouter.route('/', protectedPatchAttractionRoute);
protectedRouter.route('/', protectedSoftDeleteAttractionRoute);

export { protectedRouter as protectedAttractionRoutes };
