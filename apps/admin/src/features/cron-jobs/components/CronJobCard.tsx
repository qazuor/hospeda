/**
 * Cron Job Card Component (SPEC-161 enriched)
 *
 * Displays a single cron job with displayName, category key, human schedule,
 * last-run status, next-run time, and an inline trigger result panel.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { formatCronDateTime } from '@/lib/cron-presentation';
import {
    AlertCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    LoaderIcon,
    PlayIcon,
    XCircleIcon
} from '@repo/icons';
import { useState } from 'react';
import { useTriggerCronJobMutation } from '../hooks';
import type { CronJobAdmin, CronJobResult } from '../types';

interface CronJobCardProps {
    readonly job: CronJobAdmin;
}

/**
 * Badge variant + label for a last-run status.
 */
function LastRunBadge({
    status
}: {
    readonly status: 'success' | 'failed' | 'timeout';
}) {
    const { t } = useTranslations();

    if (status === 'success') {
        return (
            <Badge
                variant="default"
                className="gap-1 border-success/30 bg-success/15 text-success"
            >
                <CheckCircleIcon className="h-3 w-3" />
                {t('admin-billing.cron.card.lastRunSuccess')}
            </Badge>
        );
    }
    if (status === 'timeout') {
        return (
            <Badge
                variant="secondary"
                className="gap-1 border-warning/30 bg-warning/15 text-warning"
            >
                <ClockIcon className="h-3 w-3" />
                {t('admin-billing.cron.card.lastRunTimeout')}
            </Badge>
        );
    }
    return (
        <Badge
            variant="destructive"
            className="gap-1"
        >
            <XCircleIcon className="h-3 w-3" />
            {t('admin-billing.cron.card.lastRunFailed')}
        </Badge>
    );
}

/**
 * Inline result panel shown after a manual trigger resolves.
 */
function TriggerResultPanel({
    result,
    mutationError
}: {
    readonly result: CronJobResult | null;
    readonly mutationError: Error | null;
}) {
    const { t } = useTranslations();

    if (mutationError && !result) {
        return (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                        <p className="font-medium text-foreground text-sm">
                            {t('admin-billing.cron.card.runErrorTitle')}
                        </p>
                        <p className="text-muted-foreground text-xs">{mutationError.message}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!result) return null;

    const isSuccess = result.success;
    const colorClass = isSuccess
        ? 'border-success/30 bg-success/10'
        : 'border-destructive/30 bg-destructive/10';

    return (
        <div className={`rounded-lg border p-3 ${colorClass}`}>
            <div className="flex items-start gap-2">
                {isSuccess ? (
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="flex-1 space-y-1">
                    <p className="font-medium text-foreground text-sm">
                        {isSuccess
                            ? t('admin-billing.cron.card.successTitle')
                            : t('admin-billing.cron.card.errorTitle')}
                    </p>
                    <p className="text-muted-foreground text-xs">{result.message}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-muted-foreground">
                                {t('admin-billing.cron.card.processedLabel')}
                            </span>{' '}
                            <span className="font-medium">{result.processed}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">
                                {t('admin-billing.cron.card.errorsLabel')}
                            </span>{' '}
                            <span className="font-medium">{result.errors}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">
                                {t('admin-billing.cron.card.durationLabel')}
                            </span>{' '}
                            <span className="font-medium">{result.durationMs}ms</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">
                                {t('admin-billing.cron.card.modeLabel')}
                            </span>{' '}
                            <span className="font-medium">
                                {result.dryRun
                                    ? t('admin-billing.cron.card.modeDryRun')
                                    : t('admin-billing.cron.card.modeReal')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Full card for a single cron job.
 */
export function CronJobCard({ job }: CronJobCardProps) {
    const { t } = useTranslations();
    const [dryRun, setDryRun] = useState(true);
    const [triggerResult, setTriggerResult] = useState<CronJobResult | null>(null);

    const { mutate: triggerJob, isPending, error: mutationError } = useTriggerCronJobMutation();

    const handleTrigger = () => {
        // Clear previous result on each new run
        setTriggerResult(null);
        triggerJob(
            { jobName: job.name, dryRun },
            {
                onSuccess: (response) => {
                    setTriggerResult(response);
                }
            }
        );
    };

    const lastRunDateTime = job.lastRun ? formatCronDateTime(job.lastRun.finishedAt) : null;
    const nextRunDateTime = job.nextRunAt ? formatCronDateTime(job.nextRunAt) : null;

    return (
        <Card className={job.enabled ? '' : 'opacity-60'}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                        {/* displayName (prominent) + enabled badge */}
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base leading-snug">
                                {job.displayName}
                            </CardTitle>
                            {job.enabled ? (
                                <Badge
                                    variant="default"
                                    className="border-success/30 bg-success/15 text-success"
                                >
                                    {t('admin-billing.cron.card.statusActive')}
                                </Badge>
                            ) : (
                                <Badge variant="secondary">
                                    {t('admin-billing.cron.card.statusDisabled')}
                                </Badge>
                            )}
                        </div>
                        {/* name (key) — muted monospace secondary label */}
                        <p className="font-mono text-muted-foreground text-xs">{job.name}</p>
                    </div>
                </div>
                {/* Description */}
                <p className="text-muted-foreground text-sm">{job.description}</p>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Schedule row: human-readable primary, raw expression as tooltip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <div className="flex items-center gap-1.5">
                        <ClockIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            {t('admin-billing.cron.card.scheduleLabel')}
                        </span>
                        <span
                            className="cursor-default font-medium"
                            title={job.schedule}
                        >
                            {job.scheduleHuman}
                        </span>
                    </div>
                </div>

                {/* Last run + Next run info row */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    {/* Last run */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                            {t('admin-billing.cron.card.lastRunLabel')}
                        </span>
                        {job.lastRun ? (
                            <span className="flex items-center gap-1">
                                <LastRunBadge status={job.lastRun.status} />
                                {lastRunDateTime && (
                                    <span className="text-muted-foreground">{lastRunDateTime}</span>
                                )}
                            </span>
                        ) : (
                            <span className="text-muted-foreground italic">
                                {t('admin-billing.cron.card.neverRun')}
                            </span>
                        )}
                    </div>

                    {/* Next run */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                            {t('admin-billing.cron.card.nextRunLabel')}
                        </span>
                        <span className="font-medium">
                            {nextRunDateTime ?? t('admin-billing.cron.card.noNextRun')}
                        </span>
                    </div>
                </div>

                {/* Manual trigger section — only for enabled jobs */}
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

                        <div className="flex justify-end">
                            <Button
                                onClick={handleTrigger}
                                disabled={isPending}
                                size="sm"
                                variant="outline"
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
                    </div>
                )}

                {/* Inline trigger result (success or error) */}
                <TriggerResultPanel
                    result={triggerResult}
                    mutationError={mutationError}
                />
            </CardContent>
        </Card>
    );
}
