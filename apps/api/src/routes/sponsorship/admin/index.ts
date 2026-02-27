/**
 * Admin sponsorship routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminListSponsorshipsRoute } from './list';

const app = createRouter();

// GET / - List all sponsorships
app.route('/', adminListSponsorshipsRoute);

export { app as adminSponsorshipRoutes };
