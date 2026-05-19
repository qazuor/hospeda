/**
 * Admin sponsorship routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateSponsorshipRoute } from './create';
import { adminDeleteSponsorshipRoute } from './delete';
import { adminListSponsorshipsRoute } from './list';
import { adminUpdateSponsorshipRoute } from './update';

const app = createRouter();

// GET / - List all sponsorships
app.route('/', adminListSponsorshipsRoute);

// POST / - Create sponsorship (SPEC-117 follow-up #1)
app.route('/', adminCreateSponsorshipRoute);

// PUT /:id - Update sponsorship
app.route('/', adminUpdateSponsorshipRoute);

// DELETE /:id - Soft delete sponsorship
app.route('/', adminDeleteSponsorshipRoute);

export { app as adminSponsorshipRoutes };
