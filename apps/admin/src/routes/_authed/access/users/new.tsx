import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/new')({
    component: UsersNewPage
});

function UsersNewPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.usersNew">
            <div>{t('ui.pages.todoAddContent')}</div>
        </SidebarPageLayout>
    );
}
