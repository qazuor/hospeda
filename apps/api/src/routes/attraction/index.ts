import { createRouter } from '../../utils/create-app';
import { attractionListRoute } from './list';

const app = createRouter();

// Public routes
app.route('/', attractionListRoute);

export { app as attractionRoutes };
