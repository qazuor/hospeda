/**
 * Internal tags admin list route.
 *
 * Migrated onto `createEntityListPage` (SPEC-185 Phase 5 / T-014).
 * The framework provides FilterBar, grid view, peek drawer, URL-persisted
 * filter state, and pagination.
 *
 * Auth guard: `requireAdminApiAccess` — identical to the original route.
 * INTERNAL tags are only visible to admin users with `TAG_INTERNAL_VIEW`
 * permission — they are never shown to regular users.
 *
 * Existing child routes (`new.tsx` and `$id_.edit.tsx`) are untouched.
 *
 * @see apps/admin/src/features/tags/internal/config/internal-tags.config.ts
 */
import { InternalTagsPageComponent } from '@/features/tags/internal/config/internal-tags.config';
import { requireAdminApiAccess } from '@/lib/admin-api-access';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/tags/internal/')({
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: InternalTagsPageComponent,
    errorComponent: createErrorComponent('InternalTags'),
    pendingComponent: createPendingComponent()
});
