/**
 * Protected conversation routes (authentication required).
 *
 * All routes in this module require a valid Better Auth session. The actor is
 * resolved from context by `getActorFromContext` and all ownership checks use
 * the anti-enumeration pattern (404 instead of 403).
 *
 * Routes registered here:
 *   GET   /unread-count              — inbox badge count
 *   GET   /                          — paginated guest inbox
 *   GET   /:id                       — conversation thread
 *   POST  /initiate                  — initiate or resume a conversation
 *   POST  /:id/messages              — reply to an existing conversation
 *   PATCH /:id/archive               — toggle archived state
 */

import { createRouter } from '../../../utils/create-app';
import { archiveProtectedConversationRoute } from './archive';
import { initiateProtectedConversationRoute } from './initiate';
import { listProtectedConversationsRoute } from './list';
import { hostConversationMonthlyInquiriesRoute } from './monthly-inquiries';
import { replyProtectedConversationRoute } from './reply';
import { hostConversationResponseRateRoute } from './response-rate';
import { threadProtectedConversationRoute } from './thread';
import { unreadCountProtectedConversationRoute } from './unread-count';

const app = createRouter();

// Unread count MUST be registered before /:id to avoid path conflicts.
app.route('/', unreadCountProtectedConversationRoute);

// Paginated inbox list
app.route('/', listProtectedConversationsRoute);

// Initiate / resume a conversation. Mounted under `/initiate` to mirror the
// public tier (`POST /api/v1/public/conversations/initiate`) — without this
// prefix the route would sit on `POST /` and the web client (which posts to
// `.../conversations/initiate` in both tiers) would get a 404.
app.route('/initiate', initiateProtectedConversationRoute);

// Conversation thread (GET /:id)
app.route('/', threadProtectedConversationRoute);

// Reply to existing conversation (POST /:id/messages)
app.route('/', replyProtectedConversationRoute);

// Archive toggle (PATCH /:id/archive)
app.route('/', archiveProtectedConversationRoute);

// Host response-rate KPIs (GET /me/response-rate) — SPEC-155 T-006
app.route('/me', hostConversationResponseRateRoute);

// Host monthly inquiry trend (GET /me/monthly-inquiries) — SPEC-155 card I
app.route('/me', hostConversationMonthlyInquiriesRoute);

export { app as protectedConversationRoutes };
