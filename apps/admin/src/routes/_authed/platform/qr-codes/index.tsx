/**
 * QR-code list (HOS-981 PR 3).
 *
 * Reachable from the sidebar under Platform → General settings. There is no
 * auto-discovery in this app: a screen that is not in `config/ia/sidebars.ts` is
 * a screen nobody finds, and HOS-14 already catalogued five route groups that
 * went orphan exactly that way.
 */

import { AddIcon } from '@repo/icons';
import { PermissionEnum, type QrCode } from '@repo/schemas';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import type { DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQrCodesList } from '@/features/qr-codes/hooks/useQrCodes';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/platform/qr-codes/')({
    component: QrCodesListPage
});

function QrCodesListPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQrCodesList({
        page,
        pageSize,
        q: search.trim() === '' ? undefined : search.trim()
    });

    const columns: readonly DataTableColumn<QrCode>[] = [
        {
            id: 'label',
            accessorKey: 'label',
            header: t('qr-codes.columns.label'),
            cell: ({ row }) => <div className="font-medium">{row.label}</div>
        },
        {
            id: 'slug',
            accessorKey: 'slug',
            header: t('qr-codes.columns.slug'),
            cell: ({ row }) => <div className="font-mono text-sm">{row.slug}</div>
        },
        {
            id: 'targetUrl',
            accessorKey: 'targetUrl',
            header: t('qr-codes.columns.targetUrl'),
            cell: ({ row }) => (
                <div className="max-w-md truncate text-muted-foreground text-sm">
                    {row.targetUrl}
                </div>
            )
        },
        {
            id: 'isActive',
            accessorKey: 'isActive',
            header: t('qr-codes.columns.isActive'),
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive ? t('qr-codes.status.active') : t('qr-codes.status.inactive')}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: t('qr-codes.columns.actions'),
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
                            {t('qr-codes.actions.view')}
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
                            {t('qr-codes.actions.edit')}
                        </Link>
                    </Button>
                </div>
            )
        }
    ];

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.SETTINGS_MANAGE]}>
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="font-bold text-3xl">{t('qr-codes.title')}</h1>
                        <p className="text-muted-foreground">{t('qr-codes.description')}</p>
                    </div>
                    <Button asChild>
                        <Link to="/platform/qr-codes/new">
                            <AddIcon className="mr-2 h-4 w-4" />
                            {t('qr-codes.create')}
                        </Link>
                    </Button>
                </div>

                <div className="mb-4 max-w-md">
                    <Input
                        aria-label={t('qr-codes.search.placeholder')}
                        placeholder={t('qr-codes.search.placeholder')}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            // A new query is a new result set; staying on page 4
                            // would show an empty table and read as "no matches".
                            setPage(1);
                        }}
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={[...(data?.data ?? [])]}
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
