/**
 * Public point-of-interest routes
 * No authentication required
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetPointOfInterestByIdRoute } from './getById';
import { publicGetPointOfInterestBySlugRoute } from './getBySlug';
import { publicListPointsOfInterestRoute } from './list';

const publicRouter = createRouter();

// Register public routes
publicRouter.route('/', publicListPointsOfInterestRoute);
publicRouter.route('/', publicGetPointOfInterestByIdRoute);
publicRouter.route('/', publicGetPointOfInterestBySlugRoute);

export { publicRouter as publicPointOfInterestRoutes };
