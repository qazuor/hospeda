import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/debug')({
    component: AnalyticsDebugPage
});

function AnalyticsDebugPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsDebug">
            <div>{t('ui.pages.todoAddContent')}</div>
        </SidebarPageLayout>
    );
}
