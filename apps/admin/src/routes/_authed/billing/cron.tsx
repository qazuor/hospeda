/**
 * Cron Jobs Management Page
 *
 * Admin panel for managing and monitoring scheduled cron jobs
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { CronJobsPanel } from '@/features/cron-jobs';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { Clock } from 'lucide-react';

export const Route = createFileRoute('/_authed/billing/cron')({
    component: CronJobsPage
});

function CronJobsPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">{t('admin-billing.cron.title')}</h2>
                        <p className="text-muted-foreground">
                            {t('admin-billing.cron.description')}
                        </p>
                    </div>
                </div>

                {/* Jobs panel */}
                <CronJobsPanel />
            </div>
        </SidebarPageLayout>
    );
}
