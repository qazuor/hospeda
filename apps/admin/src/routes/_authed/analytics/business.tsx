import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/business')({
    component: AnalyticsBusinessPage
});

function AnalyticsBusinessPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsBusiness">
            <div>{t('ui.pages.todoAddContent')}</div>
        </SidebarPageLayout>
    );
}
