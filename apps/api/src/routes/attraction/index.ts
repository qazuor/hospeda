import { createRouter } from '../../utils/create-app';
// TEMPORARILY COMMENTED OUT - AttractionService import issue
// import { attractionBatchRoute } from './batch';
// import { attractionListRoute } from './list';

const app = createRouter();

// Public routes
// TEMPORARILY COMMENTED OUT - AttractionService import issue
// app.route('/', attractionListRoute);
// app.route('/', attractionBatchRoute);

export { app as attractionRoutes };
