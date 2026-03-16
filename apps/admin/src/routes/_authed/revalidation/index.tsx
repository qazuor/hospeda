/**
 * ISR Revalidation Management Page
 *
 * Three-tab admin page to manage on-demand ISR revalidation:
 * - Config tab: View and edit revalidation configs per entity type
 * - Logs tab: Browse recent revalidation log entries
 * - Manual tab: Trigger revalidation for specific paths
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped/Tabs';
import { useTranslations } from '@/hooks/use-translations';
import { useToast } from '@/hooks/use-toast';
import { formatDateWithTime } from '@/lib/format-helpers';
import { REVALIDATION_QUERY_KEYS } from '@/hooks/useRevalidation';
import {
    getRevalidationConfigs,
    getRevalidationLogs,
    getRevalidationStats,
    manualRevalidate,
    updateRevalidationConfig,
} from '@/lib/revalidation-http-adapter';
import type { RevalidationConfig, RevalidationLog, RevalidationStats } from '@repo/schemas';
import type { TranslationKey } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
    EmptyState,
    ErrorState,
    InlineNumberField,
    LoadingState,
    ManualForm,
    RevalidationResultTable,
    StatCard,
} from './components/revalidation-shared';

export const Route = createFileRoute('/_authed/revalidation/')({
    component: RevalidationPage,
});

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

/**
 * RevalidationPage
 *
 * Renders the ISR revalidation management area with Configuración, Registros,
 * and Manual tabs.
 */
function RevalidationPage() {
    const { t, locale } = useTranslations();

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">{t('revalidation.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('revalidation.pageDescription')}
                    </p>
                </div>

                <Tabs defaultValue="config">
                    <TabsList>
                        <TabsTrigger value="config">{t('revalidation.tabs.config')}</TabsTrigger>
                        <TabsTrigger value="logs">{t('revalidation.tabs.logs')}</TabsTrigger>
                        <TabsTrigger value="manual">{t('revalidation.tabs.manual')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="config">
                        <ConfigTab />
                    </TabsContent>
                    <TabsContent value="logs">
                        <LogsTab locale={locale} />
                    </TabsContent>
                    <TabsContent value="manual">
                        <ManualTab />
                    </TabsContent>
                </Tabs>
            </div>
        </SidebarPageLayout>
    );
}

// ---------------------------------------------------------------------------
// Config tab
// ---------------------------------------------------------------------------

/**
 * ConfigTab
 *
 * Renders an editable table of revalidation configs, one row per entity type.
 * Toggles and inline number edits persist via PATCH requests.
 */
function ConfigTab() {
    const { t } = useTranslations();
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const { data: configs = [], isLoading, isError } = useQuery<RevalidationConfig[]>({
        queryKey: REVALIDATION_QUERY_KEYS.configs,
        queryFn: getRevalidationConfigs,
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: string;
            input: {
                enabled?: boolean;
                autoRevalidateOnChange?: boolean;
                cronIntervalMinutes?: number;
                debounceSeconds?: number;
            };
        }) => updateRevalidationConfig(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.configs });
            addToast({ message: t('revalidation.config.updateSuccess'), variant: 'success' });
        },
        onError: () => {
            addToast({ message: t('revalidation.config.updateError'), variant: 'error' });
        },
    });

    const handleToggle = (
        config: RevalidationConfig,
        field: 'enabled' | 'autoRevalidateOnChange'
    ) => {
        updateMutation.mutate({ id: config.id, input: { [field]: !config[field] } });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('revalidation.config.cardTitle')}</CardTitle>
                <CardDescription>
                    {t('revalidation.config.cardDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <LoadingState message={t('revalidation.config.loading')} />
                ) : isError ? (
                    <ErrorState message={t('revalidation.config.error')} />
                ) : configs.length === 0 ? (
                    <EmptyState message={t('revalidation.config.empty')} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">{t('revalidation.config.entityType')}</th>
                                    <th className="px-4 py-3 text-center font-medium">{t('revalidation.config.enabled')}</th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('revalidation.config.autoRevalidate')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('revalidation.config.cronInterval')}
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        {t('revalidation.config.debounce')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((config) => (
                                    <tr key={config.id} className="border-b hover:bg-muted/50">
                                        <td className="px-4 py-3 font-mono">
                                            {config.entityType}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Switch
                                                checked={config.enabled}
                                                disabled={updateMutation.isPending}
                                                onCheckedChange={() =>
                                                    handleToggle(config, 'enabled')
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Switch
                                                checked={config.autoRevalidateOnChange}
                                                disabled={updateMutation.isPending}
                                                onCheckedChange={() =>
                                                    handleToggle(config, 'autoRevalidateOnChange')
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <InlineNumberField
                                                value={config.cronIntervalMinutes}
                                                min={1}
                                                max={10080}
                                                onSave={(v) =>
                                                    updateMutation.mutate({
                                                        id: config.id,
                                                        input: { cronIntervalMinutes: v },
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <InlineNumberField
                                                value={config.debounceSeconds}
                                                min={0}
                                                max={300}
                                                onSave={(v) =>
                                                    updateMutation.mutate({
                                                        id: config.id,
                                                        input: { debounceSeconds: v },
                                                    })
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Logs tab
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    skipped: 'secondary',
    failed: 'destructive',
};

/**
 * LogsTab
 *
 * Renders a table of recent revalidation log entries with trigger, status,
 * duration, and date columns.
 */
function LogsTab({ locale }: { readonly locale: string }) {
    const { t, tPlural } = useTranslations();
    const { data: logs = [], isLoading, isError } = useQuery<RevalidationLog[]>({
        queryKey: REVALIDATION_QUERY_KEYS.logs,
        queryFn: getRevalidationLogs,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('revalidation.logs.cardTitle')}</CardTitle>
                <CardDescription>
                    {isLoading
                        ? t('revalidation.logs.loading')
                        : isError
                          ? t('revalidation.logs.error')
                          : tPlural('revalidation.logs.found', logs.length, { count: logs.length })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <LoadingState message={t('revalidation.logs.loading')} />
                ) : isError ? (
                    <ErrorState message={t('revalidation.logs.error')} />
                ) : logs.length === 0 ? (
                    <EmptyState message={t('revalidation.logs.empty')} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium">{t('revalidation.logs.path')}</th>
                                    <th className="px-4 py-3 text-left font-medium">{t('revalidation.logs.entity')}</th>
                                    <th className="px-4 py-3 text-center font-medium">{t('revalidation.logs.trigger')}</th>
                                    <th className="px-4 py-3 text-center font-medium">{t('revalidation.logs.status')}</th>
                                    <th className="px-4 py-3 text-right font-medium">{t('revalidation.logs.duration')}</th>
                                    <th className="px-4 py-3 text-left font-medium">{t('revalidation.logs.createdAt')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b hover:bg-muted/50">
                                        <td className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                                            {log.path}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {log.entityType}
                                            {log.entityId ? (
                                                <span className="ml-1 opacity-60">
                                                    ({log.entityId.slice(0, 8)}&hellip;)
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="outline">
                                                {t(`revalidation.trigger.${log.trigger}` as TranslationKey)}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant={STATUS_VARIANTS[log.status] ?? 'outline'}
                                            >
                                                {log.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                                            {log.durationMs != null
                                                ? `${log.durationMs} ms`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {formatDateWithTime({ date: log.createdAt, locale })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Manual tab
// ---------------------------------------------------------------------------

/**
 * ManualTab
 *
 * Form to enter comma-separated paths and trigger on-demand revalidation.
 * Shows aggregated stats above the form and a result breakdown after each run.
 */
function ManualTab() {
    const { t } = useTranslations();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [pathsInput, setPathsInput] = useState('');
    const [reason, setReason] = useState('');

    const { data: stats, isLoading: statsLoading } = useQuery<RevalidationStats>({
        queryKey: REVALIDATION_QUERY_KEYS.stats,
        queryFn: getRevalidationStats,
    });

    const mutation = useMutation({
        mutationFn: manualRevalidate,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.logs });
            const succeeded = result.revalidated.length;
            const failed = result.failed.length;
            addToast({
                message: t('revalidation.manual.successToast', {
                    succeeded,
                    succeededSuffix: succeeded !== 1 ? 's' : '',
                    failed,
                    failedSuffix: failed !== 1 ? 's' : '',
                }),
                variant: failed > 0 ? 'error' : 'success',
            });
            setPathsInput('');
            setReason('');
        },
        onError: () => {
            addToast({ message: t('revalidation.manual.errorToast'), variant: 'error' });
        },
    });

    const parsedPaths = pathsInput.split(',').map((p) => p.trim()).filter(Boolean);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parsedPaths.length === 0) return;
        mutation.mutate({ paths: parsedPaths, reason: reason || undefined });
    };

    return (
        <div className="space-y-6">
            {!statsLoading && stats ? (
                <div className="grid gap-4 md:grid-cols-3">
                    <StatCard label={t('revalidation.manual.statTotalLabel')} value={stats.totalRevalidations} />
                    <StatCard
                        label={t('revalidation.manual.statSuccessRateLabel')}
                        value={Math.round(stats.successRate * 100)}
                        suffix="%"
                    />
                    <StatCard label={t('revalidation.manual.statAvgDurationLabel')} value={stats.avgDurationMs} suffix=" ms" />
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>{t('revalidation.manual.cardTitle')}</CardTitle>
                    <CardDescription>
                        {t('revalidation.manual.cardDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ManualForm
                        pathsInput={pathsInput}
                        reason={reason}
                        isPending={mutation.isPending}
                        parsedCount={parsedPaths.length}
                        onPathsChange={setPathsInput}
                        onReasonChange={setReason}
                        onSubmit={handleSubmit}
                    />
                </CardContent>
            </Card>

            {mutation.data ? <RevalidationResultTable result={mutation.data} /> : null}
        </div>
    );
}
