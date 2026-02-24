/**
 * Public destination routes
 * All routes here are accessible without authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicDestinationReviewRoutes } from '../reviews/public/index.js';
import { publicGetDestinationAccommodationsRoute } from './getAccommodations';
import { publicGetDestinationAncestorsRoute } from './getAncestors';
import { publicGetDestinationBreadcrumbRoute } from './getBreadcrumb';
import { publicGetDestinationByIdRoute } from './getById';
import { publicGetDestinationByPathRoute } from './getByPath';
import { publicGetDestinationBySlugRoute } from './getBySlug';
import { publicGetDestinationChildrenRoute } from './getChildren';
import { publicGetDestinationDescendantsRoute } from './getDescendants';
import { publicGetDestinationStatsRoute } from './getStats';
import { publicGetDestinationSummaryRoute } from './getSummary';
import { publicListDestinationsRoute } from './list';

const app = createRouter();

// Register routes - static paths before dynamic :id to avoid conflicts
app.route('/', publicListDestinationsRoute);
app.route('/', publicGetDestinationBySlugRoute);
app.route('/', publicGetDestinationByPathRoute);
app.route('/', publicGetDestinationByIdRoute);
app.route('/', publicGetDestinationSummaryRoute);
app.route('/', publicGetDestinationStatsRoute);
app.route('/', publicGetDestinationAccommodationsRoute);

// Hierarchy routes (use :id param - registered after static paths)
app.route('/', publicGetDestinationChildrenRoute);
app.route('/', publicGetDestinationDescendantsRoute);
app.route('/', publicGetDestinationAncestorsRoute);
app.route('/', publicGetDestinationBreadcrumbRoute);

// Review routes
app.route('/', publicDestinationReviewRoutes);

export { app as publicDestinationRoutes };
