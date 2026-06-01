/**
 * Protected event routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedEventCommentRoutes } from '../comments/protected/index.js';
import { protectedCreateEventRoute } from './create';
import { protectedPatchEventRoute } from './patch';
import { protectedSoftDeleteEventRoute } from './softDelete';
import { protectedUpdateEventRoute } from './update';

const app = createRouter();

// POST / - Create event
app.route('/', protectedCreateEventRoute);

// PUT /:id - Update event
app.route('/', protectedUpdateEventRoute);

// PATCH /:id - Patch event
app.route('/', protectedPatchEventRoute);

// DELETE /:id - Soft delete event
app.route('/', protectedSoftDeleteEventRoute);

// POST /:eventId/comments - Create comment (SPEC-165)
app.route('/', protectedEventCommentRoutes);

export { app as protectedEventRoutes };
