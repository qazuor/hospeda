/**
 * Barrel for SPEC-237/SPEC-250 protected accommodation external reputation routes.
 *
 * All endpoints under `/api/v1/protected/accommodations/:id/external-*`
 * are assembled here and re-exported as `protectedExternalReputationRoutes`
 * for registration in `routes/index.ts`.
 *
 * SPEC-250 Phase 5: added GET /:id/external-reputation/status.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddExternalListingRoute } from './addListing';
import { protectedListExternalListingsRoute } from './listListings';
import { protectedMasterToggleRoute } from './masterToggle';
import { protectedRefreshReputationRoute } from './refresh';
import { protectedRemoveExternalListingRoute } from './removeListing';
import { protectedReputationStatusRoute } from './reputation-status';
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

// GET    /:id/external-reputation/status  (SPEC-250 Phase 5)
app.route('/', protectedReputationStatusRoute);

export { app as protectedExternalReputationRoutes };
