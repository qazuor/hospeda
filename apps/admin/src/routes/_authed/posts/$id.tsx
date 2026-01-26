/**
 * Post Detail Page Route
 *
 * Displays post content with tabs for SEO and sponsorship.
 */

import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id')({
    component: PostDetailPage
});

function PostDetailPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={postTabs}
                    basePath={`/posts/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.content')}</h2>
                    <p className="text-muted-foreground">
                        ID: <code className="rounded bg-muted px-2 py-1">{id}</code>
                    </p>
                    <p className="mt-4 text-muted-foreground text-sm">
                        {t('ui.pages.todoAddContent')}
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
