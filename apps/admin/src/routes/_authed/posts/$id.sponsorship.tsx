/**
 * Post Sponsorship Tab Route
 *
 * Displays and manages sponsorship settings for a specific post.
 */

import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id/sponsorship')({
    component: PostSponsorshipPage
});

function PostSponsorshipPage() {
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
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.sponsorship')}</h2>
                    <p className="text-muted-foreground">{t('ui.pages.todoAddContent')}</p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
