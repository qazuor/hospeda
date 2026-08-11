/**
 * @file _authed/platform/host-trades/usages/index.tsx
 * @description Benefit-usage audit and declaration suspensions (HOS-376 T-056).
 *
 * TWO SECTIONS, NEVER ONE LIST. The suspensions above are people who cannot
 * record work right now — including some suspended by the rejection threshold
 * with no human having looked (AC-11). The usage table below is an audit: it
 * blocks nobody, and its job is to make a manufactured pattern legible before
 * anyone is suspended over it.
 *
 * The write is shared: suspending from a usage row and lifting from the list
 * above are the same endpoint with a boolean, through one dialog.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { buildUsageQueryParams } from '@/features/host-trades/lib/usage-filter-params';
import {
    useHostTradeUsages,
    useSetDeclarationSuspension,
    useSuspendedProviders
} from '@/hooks/use-host-trade-usages';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import {
    SuspendDeclarationDialog,
    type SuspensionTarget
} from './-components/SuspendDeclarationDialog';
import { SuspendedProvidersSection } from './-components/SuspendedProvidersSection';
import {
    EMPTY_USAGE_FILTERS,
    UsageFilters,
    type UsageFiltersValue
} from './-components/UsageFilters';
import { UsagesTable } from './-components/UsagesTable';

export const Route = createFileRoute('/_authed/platform/host-trades/usages/')({
    component: HostTradeUsagesPage,
    errorComponent: createErrorComponent('HostTradeUsages'),
    pendingComponent: createPendingComponent()
});

const PAGE_SIZE = 25;

/** Benefit-usage audit page. */
function HostTradeUsagesPage() {
    const { t, tPlural } = useTranslations();
    const { addToast } = useToast();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<UsageFiltersValue>(EMPTY_USAGE_FILTERS);
    const [target, setTarget] = useState<SuspensionTarget | null>(null);

    const queryParams = useMemo(
        () => buildUsageQueryParams({ filters, page, pageSize: PAGE_SIZE }),
        [filters, page]
    );

    const usagesQuery = useHostTradeUsages(queryParams);
    const suspensionsQuery = useSuspendedProviders(1);
    const decision = useSetDeclarationSuspension();

    const items = usagesQuery.data?.items ?? [];
    const pagination = usagesQuery.data?.pagination;
    const suspended = suspensionsQuery.data?.items ?? [];

    /**
     * The ids the table checks before offering to suspend.
     *
     * Built only from a SUCCESSFUL read: a failed suspension request would
     * otherwise yield an empty set that reads as "nobody is suspended", and the
     * table would offer to re-suspend providers who already are.
     */
    const suspendedProviderIds = useMemo(
        () => new Set(suspensionsQuery.isSuccess ? suspended.map((item) => item.id) : []),
        [suspended, suspensionsQuery.isSuccess]
    );

    const isFiltered = Object.values(filters).some((value) => value !== '');

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL]}>
            <div className="space-y-8 p-6">
                <div>
                    <h1 className="font-bold text-2xl">{t('admin-pages.hostTradeUsages.title')}</h1>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.hostTradeUsages.subtitle')}
                    </p>
                </div>

                <SuspendedProvidersSection
                    items={suspended}
                    isLoading={suspensionsQuery.isLoading}
                    hasError={suspensionsQuery.isError}
                    isDeciding={decision.isPending}
                    onLift={({ hostTradeId, providerName }) =>
                        setTarget({ hostTradeId, providerName, suspended: false })
                    }
                />

                <section className="space-y-4">
                    <div className="flex items-baseline justify-between gap-4">
                        <div>
                            <h2 className="font-semibold text-lg">
                                {t('admin-pages.hostTradeUsages.usages.title')}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.hostTradeUsages.usages.description')}
                            </p>
                        </div>
                        {pagination && (
                            <span className="text-muted-foreground text-sm">
                                {tPlural(
                                    'admin-pages.hostTradeUsages.usages.results',
                                    pagination.total,
                                    { count: pagination.total }
                                )}
                            </span>
                        )}
                    </div>

                    <UsageFilters
                        value={filters}
                        onChange={(next) => {
                            setFilters(next);
                            setPage(1);
                        }}
                    />

                    {usagesQuery.isLoading && (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.hostTradeUsages.usages.loading')}
                        </p>
                    )}

                    {usagesQuery.isError && (
                        <p
                            className="text-destructive text-sm"
                            role="alert"
                        >
                            {t('admin-pages.hostTradeUsages.usages.error')}
                        </p>
                    )}

                    {/*
                     * Gated on a successful read for the same reason the
                     * suspension list is: a failed request that fell through to
                     * "no usages" would read as a clean audit.
                     */}
                    {usagesQuery.isSuccess && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                            <p>
                                {isFiltered
                                    ? t('admin-pages.hostTradeUsages.usages.emptyFiltered')
                                    : t('admin-pages.hostTradeUsages.usages.empty')}
                            </p>
                            {isFiltered && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setFilters(EMPTY_USAGE_FILTERS);
                                        setPage(1);
                                    }}
                                >
                                    {t('admin-pages.hostTradeUsages.usages.clearFilters')}
                                </Button>
                            )}
                        </div>
                    )}

                    {usagesQuery.isSuccess && items.length > 0 && (
                        <UsagesTable
                            items={items}
                            suspendedProviderIds={suspendedProviderIds}
                            isDeciding={decision.isPending}
                            onSuspend={({ hostTradeId, providerName }) =>
                                setTarget({ hostTradeId, providerName, suspended: true })
                            }
                        />
                    )}

                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {t('admin-pages.hostTradeUsages.usages.pagination', {
                                    page: pagination.page,
                                    totalPages: pagination.totalPages,
                                    total: pagination.total
                                })}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    {t('admin-pages.hostTradeUsages.usages.prevPage')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    {t('admin-pages.hostTradeUsages.usages.nextPage')}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                <SuspendDeclarationDialog
                    // Keyed on the decision so each one opens with an empty
                    // reason box: a reason typed for one provider must never be
                    // submittable against the next.
                    key={target ? `${target.hostTradeId}-${target.suspended}` : 'none'}
                    target={target}
                    isPending={decision.isPending}
                    onOpenChange={(open) => {
                        if (!open) setTarget(null);
                    }}
                    onConfirm={({ reason }) => {
                        if (!target) return;
                        const { hostTradeId, providerName, suspended } = target;
                        decision.mutate(
                            { hostTradeId, suspended, reason },
                            {
                                onSuccess: () => {
                                    setTarget(null);
                                    addToast({
                                        title: suspended
                                            ? t(
                                                  'admin-pages.hostTradeUsages.usages.messages.suspendedTitle'
                                              )
                                            : t(
                                                  'admin-pages.hostTradeUsages.suspensions.messages.liftedTitle'
                                              ),
                                        message: suspended
                                            ? t(
                                                  'admin-pages.hostTradeUsages.usages.messages.suspended',
                                                  { name: providerName }
                                              )
                                            : t(
                                                  'admin-pages.hostTradeUsages.suspensions.messages.lifted',
                                                  { name: providerName }
                                              ),
                                        variant: 'success'
                                    });
                                },
                                // The dialog stays OPEN on failure. Closing it
                                // would leave a toast as the only trace of a
                                // decision that did not happen, with the reason
                                // the admin typed gone with it.
                                onError: () =>
                                    addToast({
                                        title: suspended
                                            ? t(
                                                  'admin-pages.hostTradeUsages.usages.errors.suspendFailedTitle'
                                              )
                                            : t(
                                                  'admin-pages.hostTradeUsages.suspensions.errors.liftFailedTitle'
                                              ),
                                        message: suspended
                                            ? t(
                                                  'admin-pages.hostTradeUsages.usages.errors.suspendFailed'
                                              )
                                            : t(
                                                  'admin-pages.hostTradeUsages.suspensions.errors.liftFailed'
                                              ),
                                        variant: 'error'
                                    })
                            }
                        );
                    }}
                />
            </div>
        </RoutePermissionGuard>
    );
}
