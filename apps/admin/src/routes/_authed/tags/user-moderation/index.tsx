/**
 * User-moderation tags admin list route.
 *
 * Migrated onto `createEntityListPage` (SPEC-185 Phase 5 / T-015).
 * The framework provides FilterBar, grid view, peek drawer, URL-persisted
 * filter state, and pagination.
 *
 * Key constraints preserved from the original implementation (D-012):
 * - No create button — user tags are created by users, not admins.
 * - No edit action per row — TAG_USER_UPDATE_ANY is intentionally excluded.
 * - DELETE action only (requires TAG_USER_DELETE_ANY).
 * - No new.tsx / $id_.edit.tsx child routes exist for this list.
 *
 * @see apps/admin/src/features/tags/user-moderation/config/user-moderation-tags.config.ts
 * @see D-012 (TAG_USER_UPDATE_ANY exclusion)
 */

import { UserModerationTagsRoute } from '@/features/tags/user-moderation/config/user-moderation-tags.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = UserModerationTagsRoute;
