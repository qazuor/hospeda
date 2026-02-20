/**
 * Sponsor Analytics Page
 *
 * Shows a Coming Soon state until the analytics API endpoint is implemented.
 */
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsor/analytics')({
    component: SponsorAnalyticsPage
});

function SponsorAnalyticsPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout>
            <ComingSoon
                title={t('admin-common.comingSoon.title' as TranslationKey)}
                description={t('admin-common.comingSoon.sponsorAnalytics' as TranslationKey)}
            />
        </SidebarPageLayout>
    );
}
