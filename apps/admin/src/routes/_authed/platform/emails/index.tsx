/**
 * Email previewer (HOS-2519 PR-2).
 *
 * URL: /platform/emails. Reachable from the sidebar under Plataforma →
 * Configuración general. Lists every email the platform can send and shows the
 * server-rendered subject, HTML (desktop/mobile width) and text body of a
 * sample scenario. Read-only: nothing is sent.
 *
 * Gate: `NOTIFICATION_TEMPLATE_PREVIEW`, the same permission the sidebar entry
 * and both API routes declare (HOS-981: menu gate === route gate).
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EmailPreviewsScreen } from './-components/EmailPreviewsScreen';

export const Route = createFileRoute('/_authed/platform/emails/')({
    component: EmailPreviewsPage,
    errorComponent: createErrorComponent('EmailPreviews'),
    pendingComponent: createPendingComponent()
});

/** The route component: permission guard, page chrome and the previewer. */
function EmailPreviewsPage() {
    return (
        <RoutePermissionGuard permissions={[PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]}>
            <SidebarPageLayout titleKey="admin-pages.emailPreviews.title">
                <EmailPreviewsScreen />
            </SidebarPageLayout>
        </RoutePermissionGuard>
    );
}
