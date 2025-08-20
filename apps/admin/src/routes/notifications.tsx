import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/notifications')({
    component: NotificationsPage
});

function NotificationsPage() {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('admin-pages.titles.notifications')}>
            <div>TODO: add content</div>
        </MainPageLayout>
    );
}
