import type { TranslationKey } from '@repo/i18n';
import type { AdminSubscriptionListItemHttp } from '@repo/schemas';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import type { DataTableColumn, DataTableSort } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import type { AdminSubscriptionStatus } from '../hooks/useAdminSubscriptions';
import { useAdminSubscriptions } from '../hooks/useAdminSubscriptions';

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_VALUES: readonly AdminSubscriptionStatus[] = [
    'PENDING_AUTHORIZATION',
    'ABANDONED',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED',
    'CANCELLED',
    'CHARGE_DECLINED'
];

const VERTICAL_VALUES: readonly VerticalEnum[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE,
    VerticalEnum.TOURIST,
    VerticalEnum.PARTNER
];

type Item = AdminSubscriptionListItemHttp;

/**
 * Administrative subscription list. A user with `BILLING_SUBSCRIPTION_INSPECT`
 * can find a subscription by the owner email/name or a UUID, filter by vertical
 * and status, and open its detail.
 */
export function SubscriptionsListScreen() {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]}>
            <SubscriptionsBody />
        </PermissionGate>
    );
}

function SubscriptionsBody() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [search, setSearch] = useState('');
    const [vertical, setVertical] = useState<VerticalEnum | ''>('');
    const [status, setStatus] = useState<AdminSubscriptionStatus | ''>('');
    const [sort, setSort] = useState<DataTableSort>([]);
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

    const query = useAdminSubscriptions({
        page,
        pageSize,
        q: debouncedSearch || undefined,
        vertical: vertical || undefined,
        status: status || undefined
    });

    const columns = useMemo<ReadonlyArray<DataTableColumn<Item>>>(() => {
        const statusLabel = (value: AdminSubscriptionStatus): string =>
            t(`admin-billing.subscriptionAdmin.statuses.${value}` as TranslationKey);
        const classLabel = (value: Item['class']): string =>
            t(`admin-billing.subscriptionAdmin.classes.${value}` as TranslationKey);
        const verticalLabel = (value: VerticalEnum): string =>
            t(`admin-billing.subscriptionAdmin.verticals.${value}` as TranslationKey);
        const cycleLabel = (value: NonNullable<Item['cycle']>): string =>
            t(`admin-billing.subscriptionAdmin.cycles.${value}` as TranslationKey);
        const unknown = t('admin-billing.subscriptionAdmin.unknownValue');

        return [
            {
                id: 'owner',
                header: t('admin-billing.subscriptionAdmin.columns.owner'),
                cell: ({ row }) => (
                    <Link
                        to="/billing/subscriptions/$subscriptionId"
                        params={{ subscriptionId: row.id }}
                        data-testid="subscriptions-row"
                        className="underline-offset-4 hover:underline"
                    >
                        {row.owner ? row.owner.email : unknown}
                        {row.owner?.deleted ? (
                            <span className="text-muted-foreground">
                                {' '}
                                ({t('admin-billing.subscriptionAdmin.deletedOwner')})
                            </span>
                        ) : null}
                    </Link>
                )
            },
            {
                id: 'name',
                header: t('admin-billing.subscriptionAdmin.columns.name'),
                cell: ({ row }) => row.owner?.displayName ?? unknown
            },
            {
                id: 'vertical',
                header: t('admin-billing.subscriptionAdmin.columns.vertical'),
                cell: ({ row }) => (row.vertical ? verticalLabel(row.vertical) : unknown)
            },
            {
                id: 'plan',
                header: t('admin-billing.subscriptionAdmin.columns.plan'),
                cell: ({ row }) => row.plan?.planName ?? unknown
            },
            {
                id: 'class',
                header: t('admin-billing.subscriptionAdmin.columns.class'),
                cell: ({ row }) => classLabel(row.class)
            },
            {
                id: 'status',
                header: t('admin-billing.subscriptionAdmin.columns.status'),
                cell: ({ row }) => statusLabel(row.status)
            },
            {
                id: 'cycle',
                header: t('admin-billing.subscriptionAdmin.columns.cycle'),
                cell: ({ row }) => (row.cycle ? cycleLabel(row.cycle) : unknown)
            },
            {
                id: 'nextCharge',
                header: t('admin-billing.subscriptionAdmin.columns.nextCharge'),
                cell: ({ row }) =>
                    row.nextChargeAt
                        ? formatDateWithTime({ date: row.nextChargeAt, locale })
                        : unknown
            },
            {
                id: 'createdAt',
                header: t('admin-billing.subscriptionAdmin.columns.createdAt'),
                cell: ({ row }) => formatDateWithTime({ date: row.createdAt, locale })
            }
        ];
    }, [t, locale]);

    if (query.isLoading) {
        return (
            <div data-testid="subscriptions-list">
                <p>{t('admin-billing.subscriptionAdmin.loading')}</p>
            </div>
        );
    }
    if (query.isError) {
        return (
            <div
                data-testid="subscriptions-list"
                role="alert"
                className="space-y-2"
            >
                <p>{t('admin-billing.subscriptionAdmin.error')}</p>
                <Button onClick={() => void query.refetch()}>
                    {t('admin-billing.subscriptionAdmin.retry')}
                </Button>
            </div>
        );
    }

    const data = query.data;
    if (!data) {
        return (
            <div data-testid="subscriptions-list">
                <p>{t('admin-billing.subscriptionAdmin.empty')}</p>
            </div>
        );
    }

    return (
        <div
            data-testid="subscriptions-list"
            className="space-y-4"
        >
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    <span>{t('admin-billing.subscriptionAdmin.searchLabel')}</span>
                    <input
                        data-testid="subscriptions-search"
                        className="rounded border px-3 py-2"
                        type="search"
                        value={search}
                        placeholder={t('admin-billing.subscriptionAdmin.searchPlaceholder')}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    <span>{t('admin-billing.subscriptionAdmin.verticalFilter')}</span>
                    <select
                        data-testid="subscriptions-filter-vertical"
                        className="rounded border px-3 py-2"
                        value={vertical}
                        onChange={(event) => {
                            setVertical(event.target.value as VerticalEnum | '');
                            setPage(1);
                        }}
                    >
                        <option value="">
                            {t('admin-billing.subscriptionAdmin.allVerticals')}
                        </option>
                        {VERTICAL_VALUES.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(
                                    `admin-billing.subscriptionAdmin.verticals.${value}` as TranslationKey
                                )}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    <span>{t('admin-billing.subscriptionAdmin.statusFilter')}</span>
                    <select
                        data-testid="subscriptions-filter-status"
                        className="rounded border px-3 py-2"
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value as AdminSubscriptionStatus | '');
                            setPage(1);
                        }}
                    >
                        <option value="">{t('admin-billing.subscriptionAdmin.allStatuses')}</option>
                        {STATUS_VALUES.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(
                                    `admin-billing.subscriptionAdmin.statuses.${value}` as TranslationKey
                                )}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {data.items.length === 0 ? (
                <p>{t('admin-billing.subscriptionAdmin.empty')}</p>
            ) : (
                <DataTable<Item>
                    columns={columns}
                    data={data.items}
                    total={data.pagination.total}
                    rowId={(row) => row.id}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPage(1);
                        setPageSize(size);
                    }}
                    sort={sort}
                    onSortChange={setSort}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                />
            )}
        </div>
    );
}
