/**
 * Protected conversation routes (authentication required).
 *
 * All routes in this module require a valid Better Auth session. The actor is
 * resolved from context by `getActorFromContext` and all ownership checks use
 * the anti-enumeration pattern (404 instead of 403).
 *
 * Routes registered here:
 *   GET   /unread-count              — inbox badge count (guest)
 *   GET   /                          — paginated guest inbox
 *   POST  /initiate                  — initiate or resume a conversation
 *   GET   /owner                     — paginated owner inbox
 *   GET   /owner/unread-count        — owner inbox badge count
 *   GET   /owner/:id                 — owner conversation thread
 *   POST  /owner/:id/messages        — reply as owner
 *   GET   /:id                       — conversation thread (guest)
 *   POST  /:id/messages              — reply to an existing conversation (guest)
 *   PATCH /:id/archive               — toggle archived state
 */

import { createRouter } from '../../../utils/create-app';
import { archiveProtectedConversationRoute } from './archive';
import { initiateProtectedConversationRoute } from './initiate';
import { listProtectedConversationsRoute } from './list';
import { hostConversationMonthlyInquiriesRoute } from './monthly-inquiries';
import { ownerConversationRoutes } from './owner/index';
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

// Owner sub-router: MUST be mounted BEFORE /:id routes to avoid path conflicts.
// Hono matches routes in registration order — /owner would match /:id if mounted after.
app.route('/owner', ownerConversationRoutes);

// Conversation thread (GET /:id)
app.route('/', threadProtectedConversationRoute);

// Reply to existing conversation (POST /:id/messages)
app.route('/', replyProtectedConversationRoute);

// Archive toggle (PATCH /:id/archive)
app.route('/', archiveProtectedConversationRoute);

// Host response-rate KPIs (GET /me/response-rate) — SPEC-155 T-006.
// The route file declares the full `/me/response-rate` path, so mount at
// '/' to avoid the previously-broken double-prefix `/me/me/response-rate`.
app.route('/', hostConversationResponseRateRoute);

// Host monthly inquiry trend (GET /me/monthly-inquiries) — SPEC-155 card I
app.route('/', hostConversationMonthlyInquiriesRoute);

export { app as protectedConversationRoutes };
