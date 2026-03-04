/**
 * Cron Job Card Component
 *
 * Displays a single cron job with details and manual trigger option
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, LoaderIcon, PlayIcon } from '@repo/icons';
import { useState } from 'react';
import { useTriggerCronJobMutation } from '../hooks';
import type { CronJob, CronJobResult } from '../types';

interface CronJobCardProps {
    job: CronJob;
}

export function CronJobCard({ job }: CronJobCardProps) {
    const { t } = useTranslations();
    const [dryRun, setDryRun] = useState(true);
    const [lastResult, setLastResult] = useState<CronJobResult | null>(null);

    const { mutate: triggerJob, isPending, isError, error } = useTriggerCronJobMutation();

    const handleTrigger = () => {
        triggerJob(
            { jobName: job.name, dryRun },
            {
                onSuccess: (response) => {
                    setLastResult(response.data);
                }
            }
        );
    };

    // Format cron schedule for display using translations
    const formatSchedule = (schedule: string): string => {
        const scheduleMap: Record<string, string> = {
            '0 0 * * *': t('admin-billing.cron.schedules.daily'),
            '*/5 * * * *': t('admin-billing.cron.schedules.every5min'),
            '0 * * * *': t('admin-billing.cron.schedules.hourly'),
            '0 0 * * 0': t('admin-billing.cron.schedules.weekly'),
            '0 0 1 * *': t('admin-billing.cron.schedules.monthly')
        };

        return scheduleMap[schedule] || schedule;
    };

    return (
        <Card className={job.enabled ? '' : 'opacity-60'}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{job.name}</CardTitle>
                            {job.enabled ? (
                                <Badge
                                    variant="default"
                                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                >
                                    {t('admin-billing.cron.card.statusActive')}
                                </Badge>
                            ) : (
                                <Badge variant="secondary">
                                    {t('admin-billing.cron.card.statusDisabled')}
                                </Badge>
                            )}
                        </div>
                        <CardDescription>{job.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Schedule info */}
                <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                        {t('admin-billing.cron.card.scheduleLabel')}
                    </span>
                    <span className="font-medium">{formatSchedule(job.schedule)}</span>
                </div>

                {/* Manual trigger section */}
                {job.enabled && (
                    <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor={`dry-run-${job.name}`}
                                    className="font-medium text-sm"
                                >
                                    {t('admin-billing.cron.card.dryRunLabel')}
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.cron.card.dryRunHint')}
                                </p>
                            </div>
                            <Switch
                                id={`dry-run-${job.name}`}
                                checked={dryRun}
                                onCheckedChange={setDryRun}
                                disabled={isPending}
                            />
                        </div>

                        <Button
                            onClick={handleTrigger}
                            disabled={isPending}
                            size="sm"
                            className="w-full"
                        >
                            {isPending ? (
                                <>
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    {t('admin-billing.cron.card.runningButton')}
                                </>
                            ) : (
                                <>
                                    <PlayIcon className="mr-2 h-4 w-4" />
                                    {t('admin-billing.cron.card.runButton')}
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Last execution result */}
                {lastResult && (
                    <div
                        className={`rounded-lg border p-3 ${
                            lastResult.success
                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            {lastResult.success ? (
                                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                            ) : (
                                <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                            )}
                            <div className="flex-1 space-y-1">
                                <p
                                    className={`font-medium text-sm ${
                                        lastResult.success
                                            ? 'text-green-900 dark:text-green-100'
                                            : 'text-red-900 dark:text-red-100'
                                    }`}
                                >
                                    {lastResult.success
                                        ? t('admin-billing.cron.card.successTitle')
                                        : t('admin-billing.cron.card.errorTitle')}
                                </p>
                                <p
                                    className={`text-xs ${
                                        lastResult.success
                                            ? 'text-green-700 dark:text-green-300'
                                            : 'text-red-700 dark:text-red-300'
                                    }`}
                                >
                                    {lastResult.message}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.cron.card.processedLabel')}
                                        </span>{' '}
                                        <span className="font-medium">{lastResult.processed}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.cron.card.errorsLabel')}
                                        </span>{' '}
                                        <span className="font-medium">{lastResult.errors}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.cron.card.durationLabel')}
                                        </span>{' '}
                                        <span className="font-medium">
                                            {lastResult.durationMs}ms
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.cron.card.modeLabel')}
                                        </span>{' '}
                                        <span className="font-medium">
                                            {lastResult.dryRun
                                                ? t('admin-billing.cron.card.modeDryRun')
                                                : t('admin-billing.cron.card.modeReal')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {isError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                        <div className="flex items-start gap-2">
                            <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                            <div>
                                <p className="font-medium text-red-900 text-sm dark:text-red-100">
                                    {t('admin-billing.cron.card.runErrorTitle')}
                                </p>
                                <p className="text-red-700 text-xs dark:text-red-300">
                                    {error?.message}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
