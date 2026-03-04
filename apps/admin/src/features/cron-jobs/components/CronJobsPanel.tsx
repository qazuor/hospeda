/**
 * Cron Jobs Panel Component
 *
 * Main panel for displaying and managing all cron jobs
 */
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { ActivityIcon, AlertCircleIcon, ClockIcon, LoaderIcon } from '@repo/icons';
import { useCronJobsQuery } from '../hooks';
import { CronJobCard } from './CronJobCard';

export function CronJobsPanel() {
    const { t } = useTranslations();
    const { data, isLoading, error, isRefetching } = useCronJobsQuery();

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground text-sm">
                        {t('admin-billing.cron.loading')}
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="py-12 text-center">
                    <AlertCircleIcon className="mx-auto h-8 w-8 text-destructive" />
                    <p className="mt-4 text-destructive">{t('admin-billing.cron.errorLoading')}</p>
                    <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.jobs.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                    <ClockIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">{t('admin-billing.cron.noJobs')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats header */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-billing.cron.stats.totalJobs')}
                                </p>
                                <p className="mt-1 font-bold text-2xl">{data.totalJobs}</p>
                            </div>
                            <ClockIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-billing.cron.stats.activeJobs')}
                                </p>
                                <p className="mt-1 font-bold text-2xl text-green-600 dark:text-green-400">
                                    {data.enabledJobs}
                                </p>
                            </div>
                            <ActivityIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-billing.cron.stats.disabledJobs')}
                                </p>
                                <p className="mt-1 font-bold text-2xl text-orange-600 dark:text-orange-400">
                                    {data.totalJobs - data.enabledJobs}
                                </p>
                            </div>
                            <AlertCircleIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Auto-refresh indicator */}
            {isRefetching && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <LoaderIcon className="h-3 w-3 animate-spin text-primary" />
                    <span>{t('admin-billing.cron.refreshing')}</span>
                </div>
            )}

            {/* Job cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                {data.jobs.map((job) => (
                    <CronJobCard
                        key={job.name}
                        job={job}
                    />
                ))}
            </div>

            {/* Footer info */}
            <Card className="border-dashed bg-muted/50">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="font-medium text-sm">
                                {t('admin-billing.cron.info.title')}
                            </p>
                            <ul className="space-y-1 text-muted-foreground text-xs">
                                <li>• {t('admin-billing.cron.info.autoRun')}</li>
                                <li>• {t('admin-billing.cron.info.manualRun')}</li>
                                <li>• {t('admin-billing.cron.info.dryRunInfo')}</li>
                                <li>• {t('admin-billing.cron.info.autoRefresh')}</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
