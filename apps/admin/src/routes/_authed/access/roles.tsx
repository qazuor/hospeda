/**
 * Roles Management Page Route
 *
 * Displays and manages user roles.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/roles')({
    component: RolesPage
});

function RolesPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.accessRoles">
            <div className="rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold text-lg">{t('admin-menu.admin.roles')}</h2>
                <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
            </div>
        </SidebarPageLayout>
    );
}
