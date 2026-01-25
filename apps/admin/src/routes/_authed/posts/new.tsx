import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/new')({
    component: PostsNewPage
});

function PostsNewPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsNew">
            <div>{t('ui.pages.todoAddContent')}</div>
        </SidebarPageLayout>
    );
}
