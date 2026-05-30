/**
 * Standalone comment routes (SPEC-165). Re-exports the cross-entity comment
 * routers. Post/event-scoped comment routes live under the post/event entity
 * dirs; this dir holds only routes addressed by comment id.
 */
export { protectedCommentRoutes } from './protected/index.js';
