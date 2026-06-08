/**
 * Admin content moderation thresholds routes
 */
import { createRouter } from '../../../../utils/create-app';
import { adminGetThresholdByIdRoute } from './get-by-id';
import { adminGetResolvedThresholdRoute } from './get-resolved';
import { adminListThresholdsRoute } from './list';
import { adminPatchThresholdRoute } from './patch';

const app = createRouter();

// GET /resolved - Resolved threshold (registered before /{id} to prevent "resolved" matching as UUID)
app.route('/', adminGetResolvedThresholdRoute);

// GET / - List thresholds
app.route('/', adminListThresholdsRoute);

// GET /:id - Get by ID
app.route('/', adminGetThresholdByIdRoute);

// PATCH /:id - Partial update
app.route('/', adminPatchThresholdRoute);

export { app as adminContentModerationThresholdRoutes };
