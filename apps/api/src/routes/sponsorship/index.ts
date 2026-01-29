import { createRouter } from '../../utils/create-app';
import { createSponsorshipRoute } from './create';
import { deleteSponsorshipRoute } from './delete';
import { getSponsorshipAnalyticsRoute } from './getAnalytics';
import { sponsorshipGetByIdRoute } from './getById';
import { sponsorshipListRoute } from './list';
import { updateSponsorshipRoute } from './update';

const app = createRouter();

// Protected routes (authenticated users)
app.route('/', sponsorshipListRoute);
app.route('/', sponsorshipGetByIdRoute);
app.route('/', createSponsorshipRoute);
app.route('/', updateSponsorshipRoute);
app.route('/', deleteSponsorshipRoute);
app.route('/', getSponsorshipAnalyticsRoute);

export const sponsorshipRoutes = app;
