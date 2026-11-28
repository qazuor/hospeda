/**
 * QR-code list (HOS-981 PR 3).
 *
 * Reachable from the sidebar under Platform → General settings. There is no
 * auto-discovery in this app: a screen that is not in `config/ia/sidebars.ts` is
 * a screen nobody finds, and HOS-14 already catalogued five route groups that
 * went orphan exactly that way.
 *
 * HOS-2679 made it the place to ORGANISE codes: the full destination and scan
 * URL with copy buttons, the landing UTMs (editable for MANUAL codes), tags,
 * and a filter bar whose source defaults to MANUAL.
 */

import { AddIcon } from '@repo/icons';
import { PermissionEnum, type QrCodeAdminListItem } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DEFAULT_QR_CODE_LIST_FILTERS,
    type QrCodeListFilterState,
    QrCodeListFilters,
    toQrCodeListQueryFilters
} from '@/features/qr-codes/components/QrCodeListFilters';
import { QrCodeTagManagerDialog } from '@/features/qr-codes/components/QrCodeTagManagerDialog';
import { QrCodeTagsCell } from '@/features/qr-codes/components/QrCodeTagsCell';
import { QrCodeUrlCell } from '@/features/qr-codes/components/QrCodeUrlCell';
import { QrCodeUtmCell } from '@/features/qr-codes/components/QrCodeUtmCell';
import { useQrCodesList } from '@/features/qr-codes/hooks/useQrCodes';
import { useDebounce } from '@/hooks/use-debounce';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';

export const Route = createFileRoute('/_authed/platform/qr-codes/')({
    component: QrCodesListPage
});

function QrCodesListPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<QrCodeListFilterState>(DEFAULT_QR_CODE_LIST_FILTERS);
    const canCreate = useHasPermission(PermissionEnum.QR_CODE_CREATE);
    const canUpdate = useHasPermission(PermissionEnum.QR_CODE_UPDATE);
    const canDelete = useHasPermission(PermissionEnum.QR_CODE_DELETE);

    /**
     * One request per pause, not one per keystroke. Typing "plaza" untuned fires
     * five admin list queries, four of which are answers nobody will read.
     */
    const debouncedSearch = useDebounce(search.trim(), 300);

    const { data, isLoading } = useQrCodesList({
        page,
        pageSize,
        q: debouncedSearch === '' ? undefined : debouncedSearch,
        filters: toQrCodeListQueryFilters({ filters })
    });

    // TYPE-WORKAROUND: `createEntityHooks<QrCode>` types the rows as the base
    // entity; the list endpoint answers `QrCodeAdminListItem` (HOS-2679), which
    // only ADDS fields, and its response schema is what the API strips against.
    const rows = (data?.data ?? []) as unknown as readonly QrCodeAdminListItem[];

    const columns: readonly DataTableColumn<QrCodeAdminListItem>[] = [
        {
            id: 'label',
            accessorKey: 'label',
            header: t('admin-qr-codes.columns.label'),
            cell: ({ row }) => <div className="font-medium">{row.label}</div>
        },
        {
            id: 'slug',
            accessorKey: 'slug',
            header: t('admin-qr-codes.columns.slug'),
            cell: ({ row }) => <div className="font-mono text-sm">{row.slug}</div>
        },
        {
            id: 'targetUrl',
            accessorKey: 'targetUrl',
            header: t('admin-qr-codes.columns.targetUrl'),
            cell: ({ row }) => (
                <QrCodeUrlCell
                    targetUrl={row.targetUrl}
                    scanUrl={row.scanUrl}
                />
            )
        },
        {
            id: 'utm',
            header: t('admin-qr-codes.columns.utm'),
            cell: ({ row }) => (
                <QrCodeUtmCell
                    row={row}
                    canEdit={canUpdate}
                />
            )
        },
        {
            id: 'tags',
            header: t('admin-qr-codes.columns.tags'),
            cell: ({ row }) => (
                <QrCodeTagsCell
                    qrCodeId={row.id}
                    tags={row.tags}
                    canEdit={canUpdate}
                />
            )
        },
        {
            id: 'isActive',
            accessorKey: 'isActive',
            header: t('admin-qr-codes.columns.isActive'),
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive
                        ? t('admin-qr-codes.status.active')
                        : t('admin-qr-codes.status.inactive')}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: t('admin-qr-codes.columns.actions'),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                    >
                        <Link
                            to="/platform/qr-codes/$id"
                            params={{ id: row.id }}
                        >
                            {t('admin-qr-codes.actions.view')}
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                    >
                        <Link
                            to="/platform/qr-codes/$id/edit"
                            params={{ id: row.id }}
                        >
                            {t('admin-qr-codes.actions.edit')}
                        </Link>
                    </Button>
                </div>
            )
        }
    ];

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.QR_CODE_VIEW]}>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="font-bold text-3xl">{t('admin-qr-codes.title')}</h1>
                        <p className="text-muted-foreground">{t('admin-qr-codes.description')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <QrCodeTagManagerDialog
                            canCreate={canCreate}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                        />
                        <Button asChild>
                            <Link to="/platform/qr-codes/new">
                                <AddIcon className="mr-2 h-4 w-4" />
                                {t('admin-qr-codes.create')}
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="mb-4 max-w-md">
                    <Input
                        aria-label={t('admin-qr-codes.search.placeholder')}
                        placeholder={t('admin-qr-codes.search.placeholder')}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            // A new query is a new result set; staying on page 4
                            // would show an empty table and read as "no matches".
                            setPage(1);
                        }}
                    />
                </div>

                <div className="mb-4">
                    <QrCodeListFilters
                        value={filters}
                        onChange={(next) => {
                            setFilters(next);
                            // Same reason as the search: a new filter is a new set.
                            setPage(1);
                        }}
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={[...rows]}
                    total={data?.total ?? 0}
                    rowId={(row) => row.id}
                    loading={isLoading}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    sort={[]}
                    onSortChange={() => {}}
                    columnVisibility={{}}
                    onColumnVisibilityChange={() => {}}
                />
            </div>
        </RoutePermissionGuard>
    );
}
