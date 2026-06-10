/**
 * Owner conversation sub-router.
 *
 * Registers all owner-side protected routes under /owner.
 * Mount order matters: static paths (/unread-count) MUST come before
 * parameterized paths (/:id) to avoid path conflicts.
 *
 * Routes:
 *   GET   /unread-count              — inbox badge count
 *   GET   /                          — paginated owner inbox
 *   GET   /:id                       — conversation thread
 *   POST  /:id/messages              — reply as owner
 */

import { createRouter } from '../../../../utils/create-app';
import { listOwnerConversationsRoute } from './list';
import { replyOwnerConversationRoute } from './reply';
import { threadOwnerConversationRoute } from './thread';
import { unreadCountOwnerConversationRoute } from './unread-count';

const app = createRouter();

// Unread count MUST be registered before /:id to avoid path conflicts.
app.route('/', unreadCountOwnerConversationRoute);

// Paginated inbox list
app.route('/', listOwnerConversationsRoute);

// Conversation thread (GET /:id)
app.route('/', threadOwnerConversationRoute);

// Reply to existing conversation (POST /:id/messages)
app.route('/', replyOwnerConversationRoute);

export { app as ownerConversationRoutes };
