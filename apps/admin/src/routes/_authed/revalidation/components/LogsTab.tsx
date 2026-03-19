/**
 * LogsTab component for the ISR Revalidation Management Page.
 *
 * Renders a filterable, paginated, auto-refreshing table of revalidation log
 * entries. Filters are sent server-side for accurate pagination. Includes
 * sort support on the createdAt column and auto-refresh every 30 seconds.
 *
 * @module routes/_authed/revalidation/components/LogsTab
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { REVALIDATION_QUERY_KEYS, useRevalidationLogsFiltered } from '@/hooks/useRevalidation';
import { formatDateWithTime } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';
import { ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, RefreshIcon } from '@repo/icons';
import type { RevalidationLog, RevalidationLogFilter } from '@repo/schemas';
import {
    RevalidationEntityTypeEnum,
    RevalidationStatusEnum,
    RevalidationTriggerEnum
} from '@repo/schemas';
import type {
    RevalidationEntityType,
    RevalidationStatus,
    RevalidationTrigger
} from '@repo/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from './revalidation-shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    success: 'default',
    skipped: 'secondary',
    failed: 'destructive'
};

/** All trigger options from the Zod enum */
const TRIGGER_OPTIONS = RevalidationTriggerEnum.options;

/** All status options from the Zod enum */
const STATUS_OPTIONS = RevalidationStatusEnum.options;

/** All entity type options from the Zod enum */
const ENTITY_TYPE_OPTIONS = RevalidationEntityTypeEnum.options;

/** Default page size for the logs table */
const DEFAULT_PAGE_SIZE = 20;

/** Common select styling matching the billing notification-logs page */
const SELECT_CLASS =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

/**
 * Custom hook for debounced value.
 * Returns the debounced version of a value after the specified delay.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// ---------------------------------------------------------------------------
// LogsTab component
// ---------------------------------------------------------------------------

type LogsTabProps = {
    readonly locale: string;
};

/**
 * LogsTab
 *
 * Filterable, paginated, auto-refreshing table of revalidation log entries.
 * Filters are sent to the backend so pagination totals are accurate.
 * Auto-refreshes every 30 seconds via `refetchInterval` on the query.
 */
export function LogsTab({ locale }: LogsTabProps) {
    const { t, tPlural } = useTranslations();
    const queryClient = useQueryClient();

    // -- Filter state --
    const [entityTypeFilter, setEntityTypeFilter] = useState<RevalidationEntityType | ''>('');
    const [triggerFilter, setTriggerFilter] = useState<RevalidationTrigger | ''>('');
    const [statusFilter, setStatusFilter] = useState<RevalidationStatus | ''>('');
    const [pathFilter, setPathFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // -- Pagination state --
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // -- Sort state (only createdAt supported) --
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Debounce path filter to avoid spamming the API on every keystroke
    const debouncedPath = useDebouncedValue(pathFilter, 500);

    // Reset to page 1 when any filter or pageSize changes
    const prevFiltersRef = useRef({
        entityTypeFilter,
        triggerFilter,
        statusFilter,
        debouncedPath,
        fromDate,
        toDate,
        pageSize
    });

    useEffect(() => {
        const prev = prevFiltersRef.current;
        if (
            prev.entityTypeFilter !== entityTypeFilter ||
            prev.triggerFilter !== triggerFilter ||
            prev.statusFilter !== statusFilter ||
            prev.debouncedPath !== debouncedPath ||
            prev.fromDate !== fromDate ||
            prev.toDate !== toDate ||
            prev.pageSize !== pageSize
        ) {
            setPage(1);
            prevFiltersRef.current = {
                entityTypeFilter,
                triggerFilter,
                statusFilter,
                debouncedPath,
                fromDate,
                toDate,
                pageSize
            };
        }
    }, [entityTypeFilter, triggerFilter, statusFilter, debouncedPath, fromDate, toDate, pageSize]);

    // Build filters object for the query hook
    const filters = useMemo((): Partial<RevalidationLogFilter> => {
        const f: Partial<RevalidationLogFilter> = { page, pageSize };
        if (entityTypeFilter) f.entityType = entityTypeFilter;
        if (triggerFilter) f.trigger = triggerFilter;
        if (statusFilter) f.status = statusFilter;
        if (debouncedPath) f.path = debouncedPath;
        if (fromDate) f.fromDate = new Date(fromDate);
        if (toDate) f.toDate = new Date(toDate);
        return f;
    }, [
        page,
        pageSize,
        entityTypeFilter,
        triggerFilter,
        statusFilter,
        debouncedPath,
        fromDate,
        toDate
    ]);

    const {
        data: logPage,
        isLoading,
        isError,
        isFetching
    } = useRevalidationLogsFiltered({ filters });

    const logs: readonly RevalidationLog[] = logPage?.data ?? [];
    const total = logPage?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Client-side sort by createdAt (backend already returns DESC by default)
    const sortedLogs = useMemo(() => {
        const sorted = [...logs];
        sorted.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
        return sorted;
    }, [logs, sortDirection]);

    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.logs });
    }, [queryClient]);

    const handleClearFilters = useCallback(() => {
        setEntityTypeFilter('');
        setTriggerFilter('');
        setStatusFilter('');
        setPathFilter('');
        setFromDate('');
        setToDate('');
        setPage(1);
    }, []);

    const hasActiveFilters =
        entityTypeFilter || triggerFilter || statusFilter || pathFilter || fromDate || toDate;

    return (
        <div className="space-y-4">
            {/* Filter controls */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                        {/* Entity type filter */}
                        <div>
                            <label
                                htmlFor="logs-entity-type"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.entityType' as TranslationKey)}
                            </label>
                            <select
                                id="logs-entity-type"
                                className={SELECT_CLASS}
                                value={entityTypeFilter}
                                onChange={(e) =>
                                    setEntityTypeFilter(
                                        e.target.value as RevalidationEntityType | ''
                                    )
                                }
                            >
                                <option value="">
                                    {t('revalidation.logs.filters.all' as TranslationKey)}
                                </option>
                                {ENTITY_TYPE_OPTIONS.map((et) => (
                                    <option
                                        key={et}
                                        value={et}
                                    >
                                        {t(`revalidation.entityType.${et}` as TranslationKey)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Trigger filter */}
                        <div>
                            <label
                                htmlFor="logs-trigger"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.trigger' as TranslationKey)}
                            </label>
                            <select
                                id="logs-trigger"
                                className={SELECT_CLASS}
                                value={triggerFilter}
                                onChange={(e) =>
                                    setTriggerFilter(e.target.value as RevalidationTrigger | '')
                                }
                            >
                                <option value="">
                                    {t('revalidation.logs.filters.all' as TranslationKey)}
                                </option>
                                {TRIGGER_OPTIONS.map((tr) => (
                                    <option
                                        key={tr}
                                        value={tr}
                                    >
                                        {t(`revalidation.trigger.${tr}` as TranslationKey)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status filter */}
                        <div>
                            <label
                                htmlFor="logs-status"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.status' as TranslationKey)}
                            </label>
                            <select
                                id="logs-status"
                                className={SELECT_CLASS}
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as RevalidationStatus | '')
                                }
                            >
                                <option value="">
                                    {t('revalidation.logs.filters.all' as TranslationKey)}
                                </option>
                                {STATUS_OPTIONS.map((st) => (
                                    <option
                                        key={st}
                                        value={st}
                                    >
                                        {t(`revalidation.status.${st}` as TranslationKey)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Path filter (debounced text input) */}
                        <div>
                            <label
                                htmlFor="logs-path"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.path' as TranslationKey)}
                            </label>
                            <Input
                                id="logs-path"
                                placeholder="/en/accommodations/..."
                                value={pathFilter}
                                onChange={(e) => setPathFilter(e.target.value)}
                            />
                        </div>

                        {/* From date */}
                        <div>
                            <label
                                htmlFor="logs-from-date"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.fromDate' as TranslationKey)}
                            </label>
                            <Input
                                id="logs-from-date"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>

                        {/* To date */}
                        <div>
                            <label
                                htmlFor="logs-to-date"
                                className="mb-2 block font-medium text-sm"
                            >
                                {t('revalidation.logs.filters.toDate' as TranslationKey)}
                            </label>
                            <Input
                                id="logs-to-date"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filter actions row */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {hasActiveFilters ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearFilters}
                                >
                                    {t('revalidation.logs.filters.clearFilters' as TranslationKey)}
                                </Button>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-xs">
                                {t('revalidation.logs.autoRefresh' as TranslationKey)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isFetching}
                                aria-label={t('revalidation.logs.refresh' as TranslationKey)}
                            >
                                <RefreshIcon
                                    className={`mr-1 size-4 ${isFetching ? 'animate-spin' : ''}`}
                                />
                                {t('revalidation.logs.refresh' as TranslationKey)}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('revalidation.logs.cardTitle')}</CardTitle>
                    <CardDescription>
                        {isLoading
                            ? t('revalidation.logs.loading')
                            : isError
                              ? t('revalidation.logs.error')
                              : tPlural('revalidation.logs.found', total, { count: total })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <LoadingState message={t('revalidation.logs.loading')} />
                    ) : isError ? (
                        <ErrorState message={t('revalidation.logs.error')} />
                    ) : sortedLogs.length === 0 ? (
                        <EmptyState message={t('revalidation.logs.empty')} />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('revalidation.logs.path')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('revalidation.logs.entity')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('revalidation.logs.trigger')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('revalidation.logs.status')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('revalidation.logs.duration')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                                    onClick={() =>
                                                        setSortDirection((d) =>
                                                            d === 'desc' ? 'asc' : 'desc'
                                                        )
                                                    }
                                                    title={
                                                        sortDirection === 'desc'
                                                            ? t(
                                                                  'revalidation.logs.sortAsc' as TranslationKey
                                                              )
                                                            : t(
                                                                  'revalidation.logs.sortDesc' as TranslationKey
                                                              )
                                                    }
                                                >
                                                    {t('revalidation.logs.createdAt')}
                                                    <ChevronsUpDownIcon className="size-4" />
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedLogs.map((log) => (
                                            <tr
                                                key={log.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                                                    {log.path}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {t(
                                                        `revalidation.entityType.${log.entityType}` as TranslationKey
                                                    )}
                                                    {log.entityId ? (
                                                        <span className="ml-1 opacity-60">
                                                            ({log.entityId.slice(0, 8)}&hellip;)
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant="outline"
                                                        aria-label={`Trigger: ${log.trigger}`}
                                                    >
                                                        {t(
                                                            `revalidation.trigger.${log.trigger}` as TranslationKey
                                                        )}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={
                                                            STATUS_VARIANTS[log.status] ?? 'outline'
                                                        }
                                                        aria-label={`Status: ${log.status}`}
                                                    >
                                                        {t(
                                                            `revalidation.status.${log.status}` as TranslationKey
                                                        )}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                                                    {log.durationMs != null
                                                        ? `${log.durationMs} ms`
                                                        : '\u2014'}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDateWithTime({
                                                        date: log.createdAt,
                                                        locale
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination controls */}
                            <div className="mt-4 flex items-center justify-between border-t pt-4">
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="logs-page-size"
                                        className="text-muted-foreground text-sm"
                                    >
                                        {t(
                                            'revalidation.logs.pagination.pageSize' as TranslationKey
                                        )}
                                    </label>
                                    <select
                                        id="logs-page-size"
                                        className="h-8 rounded border border-input bg-background px-2 text-sm"
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        aria-label={t(
                                            'revalidation.logs.pagination.previous' as TranslationKey
                                        )}
                                    >
                                        <ChevronLeftIcon className="size-4" />
                                        {t(
                                            'revalidation.logs.pagination.previous' as TranslationKey
                                        )}
                                    </Button>
                                    <span className="text-muted-foreground text-sm">
                                        {t(
                                            'revalidation.logs.pagination.pageOf' as TranslationKey,
                                            { page, totalPages }
                                        )}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        aria-label={t(
                                            'revalidation.logs.pagination.next' as TranslationKey
                                        )}
                                    >
                                        {t('revalidation.logs.pagination.next' as TranslationKey)}
                                        <ChevronRightIcon className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
