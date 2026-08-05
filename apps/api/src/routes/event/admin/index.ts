/**
 * Admin event routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminEventBatchRoute } from './batch';
import { adminCreateEventRoute } from './create';
import { adminDeleteEventRoute } from './delete';
import { adminGetEventByIdRoute } from './getById';
import { adminHardDeleteEventRoute } from './hardDelete';
import { adminSetEventLifecycleStateRoute } from './lifecycleState';
import { adminListEventsRoute } from './list';
import { adminModerateEventRoute } from './moderate';
import { adminEventOptionsRoute } from './options';
import { adminPatchEventRoute } from './patch';
import { adminSetEventPublishStateRoute } from './publishState';
import { adminRestoreEventRoute } from './restore';
import { adminUpdateEventRoute } from './update';

const app = createRouter();

// GET / - List all events (including deleted)
app.route('/', adminListEventsRoute);

// POST / - Create event
app.route('/', adminCreateEventRoute);

// GET /options - Lightweight relation-selector lookup (SPEC-169 §5.5)
// Registered before /:id so Hono does not resolve "options" as a UUID param
app.route('/', adminEventOptionsRoute);

// GET /:id - Get by ID
app.route('/', adminGetEventByIdRoute);

// PUT /:id - Update event
app.route('/', adminUpdateEventRoute);

// PATCH /:id - Patch event
app.route('/', adminPatchEventRoute);

// DELETE /:id - Soft delete event
app.route('/', adminDeleteEventRoute);

// POST /batch - Get multiple events by IDs
app.route('/', adminEventBatchRoute);

// DELETE /:id/hard - Hard delete event
app.route('/', adminHardDeleteEventRoute);

// POST /:id/restore - Restore event
app.route('/', adminRestoreEventRoute);

// POST /:id/moderate - Apply the moderation verdict (HOS-374)
app.route('/', adminModerateEventRoute);

// POST /:id/publish-state - Raise or lower publication (HOS-374)
app.route('/', adminSetEventPublishStateRoute);

// POST /:id/lifecycle-state - Move through the lifecycle (HOS-374)
app.route('/', adminSetEventLifecycleStateRoute);

export { app as adminEventRoutes };
