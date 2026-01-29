import { createRouter } from '../../utils/create-app';
import { createSponsorshipPackageRoute } from './create';
import { deleteSponsorshipPackageRoute } from './delete';
import { sponsorshipPackageGetByIdRoute } from './getById';
import { sponsorshipPackageListRoute } from './list';
import { updateSponsorshipPackageRoute } from './update';

const app = createRouter();

// Public routes
app.route('/', sponsorshipPackageListRoute);
app.route('/', sponsorshipPackageGetByIdRoute);

// Admin routes
app.route('/', createSponsorshipPackageRoute);
app.route('/', updateSponsorshipPackageRoute);
app.route('/', deleteSponsorshipPackageRoute);

export const sponsorshipPackageRoutes = app;
