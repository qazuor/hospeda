/**
 * Application Logs Page — migrated to createEntityListPage (SPEC-184).
 *
 * The bespoke AppLogsPanel / AppLogFilters have been replaced by the shared
 * entity-list framework. Route search params (page, pageSize, sort, filters)
 * are managed by the generated component. The page title is rendered by the
 * framework via the `entityKey: 'appLog'` → `admin-entities.entities.appLog.*`
 * translations and the `SidebarPageLayout` from `createEntityListPage`.
 *
 * Auth guard: requireAdminApiAccess — identical to the original route.
 */
import { AppLogsPageComponent, AppLogsRoute } from '@/features/app-logs/config/app-logs.config';
import { requireAdminApiAccess } from '@/lib/admin-api-access';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/ops/logs')({
    // Mirror the validateSearch from the factory route (same pattern as
    // accommodations/index.tsx) so page/pageSize/sort/filter URL params are
    // normalized with their defaults before reaching the query layer.
    validateSearch: AppLogsRoute.options.validateSearch,
    beforeLoad: ({ context }) => requireAdminApiAccess(context),
    component: AppLogsPageComponent
});
