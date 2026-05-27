/**
 * Admin moderation routes.
 *
 * Aggregation endpoints for the admin moderation dashboard.
 * All routes require ACCOMMODATION_MODERATION_CHANGE permission.
 *
 * @module routes/moderation/admin
 * @see SPEC-155 T-010
 */
import { createRouter } from '../../../utils/create-app';
import { adminModerationPendingCountRoute } from './pending-count';

const app = createRouter();

// GET /pending-count — count of PENDING items across all four content entities
app.route('/', adminModerationPendingCountRoute);

export { app as adminModerationRoutes };
