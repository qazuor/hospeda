/**
 * @module routes/conversations
 *
 * Conversations router barrel (SPEC-085).
 *
 * Each tier router is mounted directly in `routes/index.ts` to match the
 * project-wide `/api/v1/<tier>/<entity>` convention used by every other
 * entity (accommodations, destinations, etc.):
 *   - `/api/v1/public/conversations/...`    (T-009)
 *   - `/api/v1/protected/conversations/...` (T-010)
 *   - `/api/v1/admin/conversations/...`     (T-011, pending)
 */
export { publicConversationsRouter } from './public/index';
export { protectedConversationRoutes } from './protected/index';
export { adminConversationsRouter } from './admin/index';
