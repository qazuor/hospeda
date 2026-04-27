/**
 * Admin conversation routes (admin role + conversation permissions required).
 *
 * All routes in this module require a valid Better Auth session and at least one
 * conversation-level permission (see individual route files for exact requirements).
 *
 * Routes registered here:
 *   GET  /unread-count              — OWNER-side inbox badge count
 *   GET  /                          — paginated admin conversation list
 *   GET  /:id                       — conversation thread
 *   POST /:id/messages              — post an OWNER message
 *   PATCH /:id/status               — lifecycle status transition
 *   PATCH /:id/archive              — toggle OWNER archived state
 *   DELETE /:id                     — soft-delete with cascade
 *
 * IMPORTANT: /unread-count MUST be registered before /:id to avoid path conflicts.
 */

import { createRouter } from '../../../utils/create-app';
import { archiveAdminConversationRoute } from './archive';
import { deleteAdminConversationRoute } from './delete';
import { listAdminConversationsRoute } from './list';
import { replyAdminConversationRoute } from './reply';
import { statusAdminConversationRoute } from './status';
import { threadAdminConversationRoute } from './thread';
import { unreadCountAdminConversationRoute } from './unread-count';

const app = createRouter();

// Literal path /unread-count MUST be registered before /:id to prevent
// the dynamic param route from matching the literal segment.
app.route('/', unreadCountAdminConversationRoute);

// Paginated admin list
app.route('/', listAdminConversationsRoute);

// Conversation thread (GET /:id) — registered after /unread-count
app.route('/', threadAdminConversationRoute);

// Post OWNER reply (POST /:id/messages)
app.route('/', replyAdminConversationRoute);

// Status transition (PATCH /:id/status)
app.route('/', statusAdminConversationRoute);

// Archive toggle (PATCH /:id/archive)
app.route('/', archiveAdminConversationRoute);

// Soft-delete with cascade (DELETE /:id)
app.route('/', deleteAdminConversationRoute);

export { app as adminConversationsRouter };
