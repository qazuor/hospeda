/**
 * Exchange Rates Management Page
 *
 * Manages currency exchange rates with manual overrides, fetch configuration,
 * and historical data viewing. Provides three tabs for current rates, history,
 * and configuration management.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    FetchConfigForm,
    ManualOverrideDialog,
    RateHistoryView,
    getExchangeRateColumns,
    useCreateManualOverrideMutation,
    useDeleteManualOverrideMutation,
    useExchangeRateConfigQuery,
    useExchangeRatesQuery,
    useTriggerFetchNowMutation,
    useUpdateConfigMutation
} from '@/features/exchange-rates';
import type {
    ExchangeRate,
    ExchangeRateConfig,
    ExchangeRateConfigUpdateInput,
    ExchangeRateCreateInput
} from '@/features/exchange-rates';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { AddIcon, RefreshIcon, SettingsIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/exchange-rates')({
    component: ExchangeRatesPage
});

type TabId = 'current' | 'history' | 'config';

function ExchangeRatesPage() {
    const { addToast } = useToast();
    const { t } = useTranslations();
    const [activeTab, setActiveTab] = useState<TabId>('current');
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

    // Queries
    const { data: rates, isLoading: isLoadingRates } = useExchangeRatesQuery();
    const { data: configData } = useExchangeRateConfigQuery();

    // Mutations
    const createOverrideMutation = useCreateManualOverrideMutation();
    const deleteOverrideMutation = useDeleteManualOverrideMutation();
    const triggerFetchMutation = useTriggerFetchNowMutation();
    const updateConfigMutation = useUpdateConfigMutation();

    const handleSubmitOverride = async (payload: ExchangeRateCreateInput) => {
        await createOverrideMutation.mutateAsync(payload);
    };

    const handleDelete = (id: string) => {
        if (confirm(t('admin-pages.exchangeRates.confirmDelete'))) {
            deleteOverrideMutation.mutate(id);
        }
    };

    const handleFetchNow = async () => {
        try {
            const result = await triggerFetchMutation.mutateAsync();
            addToast({
                title: t('admin-pages.exchangeRates.fetchSuccess'),
                message: t('admin-pages.exchangeRates.fetchSuccessMsg').replace(
                    '{{count}}',
                    String(result.totalStored)
                ),
                variant: 'success'
            });
        } catch {
            addToast({
                title: t('admin-pages.exchangeRates.errorTitle'),
                message: t('admin-pages.exchangeRates.fetchError'),
                variant: 'error'
            });
        }
    };

    const handleUpdateConfig = async (payload: ExchangeRateConfigUpdateInput) => {
        await updateConfigMutation.mutateAsync(payload);
    };

    const columns = getExchangeRateColumns({
        onDelete: handleDelete,
        isDeleting: deleteOverrideMutation.isPending,
        t: t as (key: string) => string
    });

    const ratesList = (Array.isArray(rates) ? rates : []) as ExchangeRate[];

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.exchangeRates.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.exchangeRates.subtitle')}
                    </p>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b">
                    <nav className="-mb-px flex space-x-8">
                        <TabButton
                            active={activeTab === 'current'}
                            onClick={() => setActiveTab('current')}
                        >
                            {t('admin-pages.exchangeRates.tabCurrent')}
                        </TabButton>
                        <TabButton
                            active={activeTab === 'history'}
                            onClick={() => setActiveTab('history')}
                        >
                            {t('admin-pages.exchangeRates.tabHistory')}
                        </TabButton>
                        <TabButton
                            active={activeTab === 'config'}
                            onClick={() => setActiveTab('config')}
                        >
                            <SettingsIcon className="mr-2 inline-block h-4 w-4" />
                            {t('admin-pages.exchangeRates.tabConfig')}
                        </TabButton>
                    </nav>
                </div>

                {/* Tab: Current Rates */}
                {activeTab === 'current' && (
                    <div className="space-y-4">
                        {/* Actions */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="text-muted-foreground text-sm">
                                {ratesList.length > 0 &&
                                    t('admin-pages.exchangeRates.ratesAvailable').replace(
                                        '{{count}}',
                                        String(ratesList.length)
                                    )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleFetchNow}
                                    disabled={triggerFetchMutation.isPending}
                                >
                                    <RefreshIcon className="mr-2 h-4 w-4" />
                                    {triggerFetchMutation.isPending
                                        ? t('admin-pages.exchangeRates.updating')
                                        : t('admin-pages.exchangeRates.updateNow')}
                                </Button>
                                <Button onClick={() => setOverrideDialogOpen(true)}>
                                    <AddIcon className="mr-2 h-4 w-4" />
                                    {t('admin-pages.exchangeRates.createOverride')}
                                </Button>
                            </div>
                        </div>

                        {/* Info Card */}
                        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                            <CardContent className="py-4">
                                <p className="text-blue-800 text-sm dark:text-blue-200">
                                    {t('admin-pages.exchangeRates.infoNote')}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Table */}
                        <DataTable
                            columns={columns}
                            data={ratesList}
                            total={ratesList.length}
                            rowId={(row) => row.id}
                            loading={isLoadingRates}
                            page={1}
                            pageSize={50}
                            onPageChange={() => {}}
                            onPageSizeChange={() => {}}
                            sort={[]}
                            onSortChange={() => {}}
                            columnVisibility={{}}
                            onColumnVisibilityChange={() => {}}
                        />

                        {/* Manual Override Dialog */}
                        <ManualOverrideDialog
                            open={overrideDialogOpen}
                            onOpenChange={setOverrideDialogOpen}
                            onSubmit={handleSubmitOverride}
                            isSubmitting={createOverrideMutation.isPending}
                        />
                    </div>
                )}

                {/* Tab: History */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="mb-2 font-semibold text-lg">
                                {t('admin-pages.exchangeRates.historyTitle')}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.exchangeRates.historyDesc')}
                            </p>
                        </div>
                        <RateHistoryView />
                    </div>
                )}

                {/* Tab: Configuration */}
                {activeTab === 'config' && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="mb-2 font-semibold text-lg">
                                {t('admin-pages.exchangeRates.configTitle')}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.exchangeRates.configDesc')}
                            </p>
                        </div>

                        <FetchConfigForm
                            config={(configData ?? null) as ExchangeRateConfig | null}
                            onSubmit={handleUpdateConfig}
                            isSubmitting={updateConfigMutation.isPending}
                        />
                    </div>
                )}
            </div>
        </SidebarPageLayout>
    );
}

/** Reusable tab button component */
function TabButton({
    active,
    onClick,
    children
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium text-sm ${
                active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            }`}
        >
            {children}
        </button>
    );
}
