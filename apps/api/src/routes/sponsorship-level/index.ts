import { createRouter } from '../../utils/create-app';
import { createSponsorshipLevelRoute } from './create';
import { deleteSponsorshipLevelRoute } from './delete';
import { sponsorshipLevelGetByIdRoute } from './getById';
import { sponsorshipLevelListRoute } from './list';
import { updateSponsorshipLevelRoute } from './update';

const app = createRouter();

// Public routes
app.route('/', sponsorshipLevelListRoute);
app.route('/', sponsorshipLevelGetByIdRoute);

// Admin routes
app.route('/', createSponsorshipLevelRoute);
app.route('/', updateSponsorshipLevelRoute);
app.route('/', deleteSponsorshipLevelRoute);

export const sponsorshipLevelRoutes = app;
