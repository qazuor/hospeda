/**
 * Dashboard page - Lazy loaded component (SPEC-155 T-035)
 *
 * This file contains the heavy UI components that are loaded on demand.
 * The route configuration is in dashboard.tsx.
 *
 * ## Migration note (T-035)
 *
 * The previous hard-coded KPI grid driven by `useDashboardStats` has been
 * replaced with the config-driven {@link DashboardRenderer}.
 * `useDashboardStats` is intentionally kept alive in
 * `@/features/dashboard/hooks/useDashboardStats` until T-036 (parity audit)
 * and T-037 (hook deletion) are complete.
 *
 * The "Actualizar" refresh button is now owned by DashboardRenderer →
 * DashboardGrid → RefreshButton.  The page no longer needs a separate
 * `actions` prop passed to SidebarPageLayout.
 *
 * Source-registry side-effect import lives inside DashboardRenderer itself
 * (`@/lib/dashboard-sources/index`), so no extra import is needed here.
 */
import { DashboardRenderer } from '@/components/dashboards/DashboardRenderer';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DashboardSkeleton } from '@/components/loading';
import { useTranslations } from '@/hooks/use-translations';
import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/_authed/dashboard')({
    component: Dashboard,
    pendingComponent: DashboardSkeleton
});

/**
 * Dashboard page component.
 *
 * Delegates all dashboard content rendering — widget grid, KPI cards, and the
 * global "Actualizar" refresh button — to {@link DashboardRenderer}, which
 * reads the current user's role config and dispatches each widget to the
 * appropriate renderer component.
 *
 * The SidebarPageLayout wrapper provides the standard page chrome (title,
 * breadcrumbs, sidebar). No `actions` prop is passed here because the renderer
 * owns the refresh button.
 */
function Dashboard() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout title={t('admin-dashboard.title')}>
            <DashboardRenderer />
        </SidebarPageLayout>
    );
}
