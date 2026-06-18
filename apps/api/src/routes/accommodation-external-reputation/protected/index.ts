/**
 * Barrel for SPEC-237 protected accommodation external reputation routes.
 *
 * All six endpoints under `/api/v1/protected/accommodations/:id/external-*`
 * are assembled here and re-exported as `protectedExternalReputationRoutes`
 * for registration in `routes/index.ts`.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddExternalListingRoute } from './addListing';
import { protectedListExternalListingsRoute } from './listListings';
import { protectedMasterToggleRoute } from './masterToggle';
import { protectedRefreshReputationRoute } from './refresh';
import { protectedRemoveExternalListingRoute } from './removeListing';
import { protectedUpdateExternalListingRoute } from './updateListing';

const app = createRouter();

// GET    /:id/external-listings
app.route('/', protectedListExternalListingsRoute);

// POST   /:id/external-listings
app.route('/', protectedAddExternalListingRoute);

// PATCH  /:id/external-listings/:listingId
app.route('/', protectedUpdateExternalListingRoute);

// DELETE /:id/external-listings/:listingId
app.route('/', protectedRemoveExternalListingRoute);

// PATCH  /:id/external-reputation/master-toggle
app.route('/', protectedMasterToggleRoute);

// POST   /:id/external-reputation/refresh
app.route('/', protectedRefreshReputationRoute);

export { app as protectedExternalReputationRoutes };
