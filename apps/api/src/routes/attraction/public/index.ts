/**
 * Public attraction routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetAttractionByIdRoute } from './getById';
import { publicGetAttractionBySlugRoute } from './getBySlug';
import { publicListAttractionsRoute } from './list';

const publicRouter = createRouter();

// Register public routes
publicRouter.route('/', publicListAttractionsRoute);
publicRouter.route('/', publicGetAttractionByIdRoute);
publicRouter.route('/', publicGetAttractionBySlugRoute);

export { publicRouter as publicAttractionRoutes };
