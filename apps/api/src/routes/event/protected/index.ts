/**
 * Protected event routes
 * Routes that require authentication
 *
 * Routes with overlapping param patterns are registered from most specific to
 * most general (/{id}/media/reorder and /{id}/media/{mediaId}/featured before
 * /{id}/media/{mediaId}), matching the convention the rest of the codebase
 * follows. It is defensive rather than load-bearing: Hono resolves a static
 * segment ahead of a param segment regardless of insertion order, verified by
 * mutation in `test/routes/post-protected-media.test.ts`.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedEventCommentRoutes } from '../comments/protected/index.js';
import { protectedAddEventMediaRoute } from './addMedia';
import { protectedCreateEventRoute } from './create';
import { protectedGetEventByIdRoute } from './getById';
import { protectedGetEventMediaRoute } from './getMedia';
import { protectedListOwnEventsRoute } from './list';
import { protectedPatchEventRoute } from './patch';
import { protectedSetEventPublishStateRoute } from './publishState';
import { protectedRemoveEventMediaRoute } from './removeMedia';
import { protectedReorderEventMediaRoute } from './reorderMedia';
import { protectedSetFeaturedEventMediaRoute } from './setFeaturedMedia';
import { protectedSoftDeleteEventRoute } from './softDelete';
import { protectedUpdateEventRoute } from './update';

const app = createRouter();

// GET / - List own events (HOS-374)
app.route('/', protectedListOwnEventsRoute);

// GET /:id - Get own event by id (HOS-374)
app.route('/', protectedGetEventByIdRoute);

// POST / - Create event
app.route('/', protectedCreateEventRoute);

// PUT /:id - Update event
app.route('/', protectedUpdateEventRoute);

// PATCH /:id - Patch event
app.route('/', protectedPatchEventRoute);

// DELETE /:id - Soft delete event
app.route('/', protectedSoftDeleteEventRoute);

// POST /:id/publish-state - Publish or unpublish own event (HOS-374)
app.route('/', protectedSetEventPublishStateRoute);

// POST /:eventId/comments - Create comment (SPEC-165)
app.route('/', protectedEventCommentRoutes);

// Media management (HOS-390) — gated on the same permission as updating the
// event, inside the service layer via checkEventCanEditMedia.

// PATCH /:id/media/reorder
app.route('/', protectedReorderEventMediaRoute);

// GET /:id/media - List gallery photos.
app.route('/', protectedGetEventMediaRoute);

// POST /:id/media - Add photo to gallery.
app.route('/', protectedAddEventMediaRoute);

// PUT /:id/media/:mediaId/featured
app.route('/', protectedSetFeaturedEventMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery.
app.route('/', protectedRemoveEventMediaRoute);

export { app as protectedEventRoutes };
