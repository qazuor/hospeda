/**
 * Cron Jobs Panel Component (SPEC-161 enriched)
 *
 * Main panel for displaying and managing all cron jobs, grouped by
 * category in CRON_CATEGORY_ORDER order. Within each group, jobs are
 * sorted: failed → timeout → never-run → success, then by displayName.
 */
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { CRON_CATEGORY_LABELS, CRON_CATEGORY_ORDER } from '@/lib/cron-presentation';
import { translateAdminApiError } from '@/lib/errors';
import type { ApiErrorShape } from '@repo/i18n';
import {
    ActivityIcon,
    AlertCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClockIcon,
    LoaderIcon
} from '@repo/icons';
import type { CronJobAdmin } from '@repo/schemas';
import { useState } from 'react';
import { useCronJobsQuery } from '../hooks';
import { CronJobCard } from './CronJobCard';

/** Numeric sort rank for a job based on its last-run status (lower = more urgent). */
function urgencyRank(job: CronJobAdmin): number {
    if (!job.lastRun) return 2; // never run
    if (job.lastRun.status === 'failed') return 0;
    if (job.lastRun.status === 'timeout') return 1;
    return 3; // success
}

/** Sort jobs by urgency first, then by displayName (locale-aware). */
function sortJobs(jobs: CronJobAdmin[]): CronJobAdmin[] {
    return [...jobs].sort((a, b) => {
        const rankDiff = urgencyRank(a) - urgencyRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.displayName.localeCompare(b.displayName, 'es');
    });
}

/** Count of jobs whose last run failed or timed out. */
function failureCount(jobs: CronJobAdmin[]): number {
    return jobs.filter((j) => j.lastRun?.status === 'failed' || j.lastRun?.status === 'timeout')
        .length;
}

export function CronJobsPanel() {
    const { t } = useTranslations();
    const { data, isLoading, error, isRefetching } = useCronJobsQuery();
    // Per-category collapse overrides. Default-open behaviour (computed from
    // failures) applies until the user explicitly toggles a category.
    const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

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
                    <p className="mt-2 text-muted-foreground text-sm">
                        {translateAdminApiError({ error: error as ApiErrorShape, t })}
                    </p>
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

    // Build a map category → jobs for fast lookup
    const byCategory = new Map<string, CronJobAdmin[]>();
    for (const job of data.jobs) {
        const existing = byCategory.get(job.category) ?? [];
        existing.push(job);
        byCategory.set(job.category, existing);
    }

    // Only render categories that actually have jobs, in canonical order
    const activeCategories = CRON_CATEGORY_ORDER.filter((cat) => byCategory.has(cat));

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
                                <p className="mt-1 font-bold text-2xl text-success">
                                    {data.enabledJobs}
                                </p>
                            </div>
                            <ActivityIcon className="h-8 w-8 text-success" />
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
                                <p className="mt-1 font-bold text-2xl text-warning">
                                    {data.totalJobs - data.enabledJobs}
                                </p>
                            </div>
                            <AlertCircleIcon className="h-8 w-8 text-warning" />
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

            {/* Category groups — each a collapsible bordered panel. Categories
                with failures start expanded; the rest start collapsed (until
                the user toggles them). */}
            {activeCategories.map((category) => {
                const jobs = sortJobs(byCategory.get(category) ?? []);
                const label = CRON_CATEGORY_LABELS[category];
                const failures = failureCount(jobs);
                const isOpen = openOverrides[category] ?? failures > 0;
                const toggle = () => setOpenOverrides((prev) => ({ ...prev, [category]: !isOpen }));

                return (
                    <Card
                        key={category}
                        aria-label={label}
                        className="overflow-hidden"
                    >
                        {/* Collapsible header */}
                        <button
                            type="button"
                            onClick={toggle}
                            aria-expanded={isOpen}
                            className="flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70"
                        >
                            {isOpen ? (
                                <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <h2 className="font-semibold text-base text-foreground">{label}</h2>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                                {jobs.length}
                            </span>
                            {failures > 0 && (
                                <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                                    <AlertCircleIcon className="h-3 w-3" />
                                    {failures}
                                </span>
                            )}
                        </button>

                        {/* Job cards grid — only when expanded */}
                        {isOpen && (
                            <CardContent className="pt-4">
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {jobs.map((job) => (
                                        <CronJobCard
                                            key={job.name}
                                            job={job}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                );
            })}

            {/* Footer info */}
            <Card className="border-dashed bg-muted/50">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
