/**
 * @module routes/conversations/public
 *
 * Public conversation routes barrel.
 *
 * Mounts all five public conversation endpoints onto a single Hono router
 * (`publicConversationsRouter`) that is then composed into the unified
 * conversations router in `../index.ts`.
 *
 * Routes:
 * - POST   /initiate                  — anonymous guest initiates a conversation
 * - GET    /verify/:verificationToken — email verification redirect
 * - POST   /request-access            — request a new magic-link (anti-enumeration)
 * - GET    /guest/:token              — load thread by access token
 * - POST   /guest/:token/messages     — post a reply by access token
 */
import { createRouter } from '../../../utils/create-app';
import { guestReplyPublicConversationRoute } from './guest-reply';
import { guestThreadPublicConversationRoute } from './guest-thread';
import { initiatePublicConversationRoute } from './initiate';
import { requestAccessPublicConversationRoute } from './request-access';
import { verifyPublicConversationRoute } from './verify';

/** Public conversations router — all 5 public routes mounted. */
export const publicConversationsRouter = createRouter()
    .route('/initiate', initiatePublicConversationRoute)
    .route('/verify', verifyPublicConversationRoute)
    .route('/request-access', requestAccessPublicConversationRoute)
    .route('/guest', guestThreadPublicConversationRoute)
    .route('/guest', guestReplyPublicConversationRoute);

export {
    guestReplyPublicConversationRoute,
    guestThreadPublicConversationRoute,
    initiatePublicConversationRoute,
    requestAccessPublicConversationRoute,
    verifyPublicConversationRoute
};
