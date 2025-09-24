import { createRouter } from '../../utils/create-app';
import { attractionBatchRoute } from './batch';
import { attractionListRoute } from './list';

const app = createRouter();

// Public routes
app.route('/', attractionListRoute);
app.route('/', attractionBatchRoute);

export { app as attractionRoutes };
