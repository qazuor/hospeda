/**
 * User Activity Tab Route
 *
 * Displays activity log for a specific user.
 */

import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id/activity')({
    component: UserActivityPage
});

function UserActivityPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.usersView">
            <div className="space-y-4">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.activity')}</h2>
                    <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
