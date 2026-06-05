/**
 * Post-tags admin list route.
 *
 * Migrated onto `createEntityListPage` (SPEC-185 Phase 5 / T-013).
 * The framework provides FilterBar, grid view, peek drawer, URL-persisted
 * filter state, and pagination.
 *
 * Existing child routes (`new.tsx` and `$id_.edit.tsx`) are untouched.
 *
 * @see apps/admin/src/features/tags/post-tags/config/post-tags.config.ts
 */

import { PostTagsRoute } from '@/features/tags/post-tags/config/post-tags.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = PostTagsRoute;
