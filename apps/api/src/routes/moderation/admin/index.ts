/**
 * Admin moderation routes.
 *
 * Aggregation endpoints for the admin moderation dashboard:
 * - `GET /pending-count` — PENDING content entities (accommodations, destinations, posts, events)
 * - `GET /reviews/pending-count` — PENDING reviews by type (accommodation vs destination)
 *
 * @module routes/moderation/admin
 * @see SPEC-155 T-010
 * @see SPEC-166 T-019
 */
import { createRouter } from '../../../utils/create-app';
import { adminHostTradeReviewsPendingCountRoute } from './host-trade-reviews-pending-count';
import { adminModerationPendingCountRoute } from './pending-count';
import { adminReviewsPendingCountRoute } from './reviews-pending-count';

const app = createRouter();

// GET /pending-count — count of PENDING items across all four content entities (SPEC-155 T-010)
app.route('/', adminModerationPendingCountRoute);

// GET /reviews/pending-count — count of PENDING reviews by type (SPEC-166 T-019)
app.route('/', adminReviewsPendingCountRoute);

// GET /host-trade-reviews/pending-count — the two host-trade queues, kept apart
// because they mean different things: reviews are backlog, replies are blocked
// providers (HOS-376 T-037)
app.route('/', adminHostTradeReviewsPendingCountRoute);

export { app as adminModerationRoutes };
