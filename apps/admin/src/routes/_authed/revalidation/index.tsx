/**
 * ISR Revalidation Management Page
 *
 * Three-tab admin page to manage on-demand ISR revalidation:
 * - Config tab: View and edit revalidation configs per entity type
 * - Logs tab: Browse recent revalidation log entries
 * - Manual tab: Trigger revalidation for specific paths
 */
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped/Tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { REVALIDATION_QUERY_KEYS } from '@/hooks/useRevalidation';
import {
    getRevalidationConfigs,
    getRevalidationStats,
    manualRevalidate,
    revalidateByType,
    updateRevalidationConfig
} from '@/lib/revalidation-http-adapter';
import type { TranslationKey } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import type { RevalidationConfig, RevalidationStats } from '@repo/schemas';
import { PermissionEnum, RevalidationEntityTypeEnum } from '@repo/schemas';
import type { RevalidationEntityType } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { LogsTab } from './components/LogsTab';
import {
    EmptyState,
    ErrorState,
    InlineNumberField,
    LoadingState,
    ManualForm,
    RevalidationResultTable,
    StatCard
} from './components/revalidation-shared';

export const Route = createFileRoute('/_authed/revalidation/')({
    component: RevalidationPage
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
        <RoutePermissionGuard permissions={[PermissionEnum.REVALIDATION_CONFIG_VIEW]}>
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">{t('revalidation.title')}</h2>
                        <p className="text-muted-foreground">{t('revalidation.pageDescription')}</p>
                    </div>

                    <Tabs defaultValue="config">
                        <TabsList>
                            <TabsTrigger value="config">
                                {t('revalidation.tabs.config')}
                            </TabsTrigger>
                            <TabsTrigger value="logs">{t('revalidation.tabs.logs')}</TabsTrigger>
                            <TabsTrigger value="manual">
                                {t('revalidation.tabs.manual')}
                            </TabsTrigger>
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
        </RoutePermissionGuard>
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

    const {
        data: configs = [],
        isLoading,
        isError
    } = useQuery<RevalidationConfig[]>({
        queryKey: REVALIDATION_QUERY_KEYS.configs,
        queryFn: getRevalidationConfigs
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            input
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
        }
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
                <CardDescription>{t('revalidation.config.cardDescription')}</CardDescription>
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
                                    <th className="px-4 py-3 text-left font-medium">
                                        {t('revalidation.config.entityType')}
                                    </th>
                                    <th className="px-4 py-3 text-center font-medium">
                                        {t('revalidation.config.enabled')}
                                    </th>
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
                                    <tr
                                        key={config.id}
                                        className="border-b hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3 font-mono">{config.entityType}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Switch
                                                checked={config.enabled}
                                                disabled={updateMutation.isPending}
                                                aria-label={`Toggle ${config.entityType} revalidation enabled`}
                                                onCheckedChange={() =>
                                                    handleToggle(config, 'enabled')
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Switch
                                                checked={config.autoRevalidateOnChange}
                                                disabled={updateMutation.isPending}
                                                aria-label={`Toggle ${config.entityType} auto-revalidate on change`}
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
                                                aria-label={`${config.entityType} cron interval minutes`}
                                                onSave={(v) =>
                                                    updateMutation.mutate({
                                                        id: config.id,
                                                        input: { cronIntervalMinutes: v }
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <InlineNumberField
                                                value={config.debounceSeconds}
                                                min={0}
                                                max={300}
                                                aria-label={`${config.entityType} debounce seconds`}
                                                onSave={(v) =>
                                                    updateMutation.mutate({
                                                        id: config.id,
                                                        input: { debounceSeconds: v }
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

// LogsTab extracted to its own file due to size (filters, pagination, sorting, auto-refresh)

// ---------------------------------------------------------------------------
// Manual tab
// ---------------------------------------------------------------------------

/**
 * ManualTab
 *
 * Form to enter comma-separated paths and trigger on-demand revalidation,
 * plus a section to revalidate all pages for a specific entity type.
 * Shows aggregated stats above the forms and a result breakdown after each run.
 */
function ManualTab() {
    const { t } = useTranslations();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [pathsInput, setPathsInput] = useState('');
    const [reason, setReason] = useState('');

    const { data: stats, isLoading: statsLoading } = useQuery<RevalidationStats>({
        queryKey: REVALIDATION_QUERY_KEYS.stats,
        queryFn: getRevalidationStats
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
                    failedSuffix: failed !== 1 ? 's' : ''
                }),
                variant: failed > 0 ? 'error' : 'success'
            });
            setPathsInput('');
            setReason('');
        },
        onError: () => {
            addToast({ message: t('revalidation.manual.errorToast'), variant: 'error' });
        }
    });

    const parsedPaths = pathsInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parsedPaths.length === 0) return;
        mutation.mutate({ paths: parsedPaths, reason: reason || undefined });
    };

    return (
        <div className="space-y-6">
            {!statsLoading && stats ? (
                <div className="grid gap-4 md:grid-cols-3">
                    <StatCard
                        label={t('revalidation.manual.statTotalLabel')}
                        value={stats.totalRevalidations}
                    />
                    <StatCard
                        label={t('revalidation.manual.statSuccessRateLabel')}
                        value={Math.round(stats.successRate * 100)}
                        suffix="%"
                    />
                    <StatCard
                        label={t('revalidation.manual.statAvgDurationLabel')}
                        value={stats.avgDurationMs}
                        suffix=" ms"
                    />
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>{t('revalidation.manual.cardTitle')}</CardTitle>
                    <CardDescription>{t('revalidation.manual.cardDescription')}</CardDescription>
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

            {/* Divider between path-based and entity-type revalidation */}
            <div className="border-t pt-2" />

            <EntityTypeRevalidationSection />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Entity type revalidation
// ---------------------------------------------------------------------------

/** All entity type values from the Zod enum */
const ENTITY_TYPE_OPTIONS = RevalidationEntityTypeEnum.options;

/**
 * EntityTypeRevalidationSection
 *
 * Allows the admin to select an entity type and regenerate all cached pages
 * for that type. Includes a confirmation dialog before executing.
 */
function EntityTypeRevalidationSection() {
    const { t } = useTranslations();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [selectedType, setSelectedType] = useState<RevalidationEntityType | ''>('');
    const [showConfirm, setShowConfirm] = useState(false);

    const byTypeMutation = useMutation({
        mutationFn: revalidateByType,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.logs });
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.stats });
            const succeeded = result.revalidated.length;
            const failed = result.failed.length;
            addToast({
                message: t('revalidation.manual.byTypeSuccessToast', {
                    succeeded,
                    failed
                }),
                variant: failed > 0 ? 'error' : 'success'
            });
            setSelectedType('');
        },
        onError: () => {
            addToast({ message: t('revalidation.manual.byTypeErrorToast'), variant: 'error' });
        }
    });

    const handleConfirm = () => {
        if (!selectedType) return;
        setShowConfirm(false);
        byTypeMutation.mutate({ entityType: selectedType });
    };

    /** Translated label for the currently selected entity type */
    const selectedTypeLabel = selectedType
        ? t(`revalidation.entityType.${selectedType}` as TranslationKey)
        : '';

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('revalidation.manual.byTypeTitle')}</CardTitle>
                    <CardDescription>{t('revalidation.manual.byTypeDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="entity-type-select"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.manual.entityTypeLabel')}
                            </label>
                            <Select
                                value={selectedType}
                                onValueChange={(v) => setSelectedType(v as RevalidationEntityType)}
                            >
                                <SelectTrigger
                                    id="entity-type-select"
                                    className="w-full max-w-sm"
                                >
                                    <SelectValue
                                        placeholder={t('revalidation.manual.entityTypePlaceholder')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENTITY_TYPE_OPTIONS.map((entityType) => (
                                        <SelectItem
                                            key={entityType}
                                            value={entityType}
                                        >
                                            {t(
                                                `revalidation.entityType.${entityType}` as TranslationKey
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="destructive"
                                disabled={!selectedType || byTypeMutation.isPending}
                                onClick={() => setShowConfirm(true)}
                            >
                                {byTypeMutation.isPending ? (
                                    <>
                                        <LoaderIcon className="mr-2 size-4 animate-spin" />
                                        {t('revalidation.manual.byTypeSubmittingButton')}
                                    </>
                                ) : (
                                    t('revalidation.manual.byTypeSubmitButton')
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {byTypeMutation.data ? <RevalidationResultTable result={byTypeMutation.data} /> : null}

            <AlertDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('revalidation.manual.byTypeConfirmTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('revalidation.manual.byTypeConfirmDescription', {
                                entityType: selectedTypeLabel
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t('revalidation.manual.byTypeConfirmCancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            {t('revalidation.manual.byTypeConfirmAction')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
