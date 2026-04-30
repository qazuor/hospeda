/**
 * PostTag route aggregator
 *
 * Re-exports all PostTag route tiers:
 * - Admin CRUD: full CRUD for PostTag entities (list, create, get, update, impact, delete)
 * - Admin Assignment: post-level assignment management (set/remove PostTags on posts)
 * - Public: ACTIVE PostTag listing for anonymous visitors
 *
 * Mounting:
 *   adminPostTagCrudRoutes:       /api/v1/admin/posts/tags
 *   adminPostTagAssignmentRoutes: /api/v1/admin/posts
 *   publicPostTagRoutes:          /api/v1/public/posts/tags
 *
 * @see SPEC-086 D-001, D-013, D-024
 */
export { adminPostTagCrudRoutes, adminPostTagAssignmentRoutes } from './admin/index.js';
export { publicPostTagRoutes } from './public/index.js';
