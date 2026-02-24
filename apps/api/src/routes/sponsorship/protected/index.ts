/**
 * Protected sponsorship routes
 * Routes that require user authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateSponsorshipRoute } from './create';
import { protectedGetSponsorshipAnalyticsRoute } from './getAnalytics';
import { protectedSponsorshipGetByIdRoute } from './getById';
import { protectedSponsorshipListRoute } from './list';
import { protectedDeleteSponsorshipRoute } from './softDelete';
import { protectedUpdateSponsorshipRoute } from './update';

const app = createRouter();

// GET / - List sponsorships
app.route('/', protectedSponsorshipListRoute);

// GET /:id - Get sponsorship by ID
app.route('/', protectedSponsorshipGetByIdRoute);

// GET /:id/analytics - Get sponsorship analytics
app.route('/', protectedGetSponsorshipAnalyticsRoute);

// POST / - Create sponsorship
app.route('/', protectedCreateSponsorshipRoute);

// PUT /:id - Update sponsorship
app.route('/', protectedUpdateSponsorshipRoute);

// DELETE /:id - Soft delete sponsorship
app.route('/', protectedDeleteSponsorshipRoute);

export { app as protectedSponsorshipRoutes };
