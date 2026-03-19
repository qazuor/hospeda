/**
 * Sponsorship Packages Tab Component
 *
 * Displays and manages sponsorship packages in a data table.
 */
import { ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    useSponsorshipPackagesQuery,
    useTogglePackageActiveMutation
} from '@/features/sponsorships/hooks/useSponsorshipQueries';
import type { SponsorshipPackage } from '@/features/sponsorships/types';
import { useTranslations } from '@/hooks/use-translations';
import { formatCurrency } from '@repo/i18n';
import { AddIcon } from '@repo/icons';
import { useState } from 'react';

/**
 * Sponsorship Packages Tab
 */
export function SponsorshipPackagesTab() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipPackagesQuery({
        page,
        pageSize
    });

    const toggleActiveMutation = useTogglePackageActiveMutation();

    const formatPrice = (amount: number) => {
        return formatCurrency({ value: amount, locale, currency: 'ARS' });
    };

    const columns: DataTableColumn<SponsorshipPackage>[] = [
        {
            id: 'name',
            header: t('admin-billing.sponsorships.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'price',
            header: t('admin-billing.sponsorships.columns.pricePerMonth'),
            enableSorting: true,
            cell: ({ row }) => <span className="font-medium">{formatPrice(row.priceAmount)}</span>
        },
        {
            id: 'includedPosts',
            header: t('admin-billing.sponsorships.columns.includedPosts'),
            accessorKey: 'includedPosts',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'includedEvents',
            header: t('admin-billing.sponsorships.columns.includedEvents'),
            accessorKey: 'includedEvents',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'eventLevel',
            header: t('admin-billing.sponsorships.columns.eventLevel'),
            accessorKey: 'eventLevelId',
            enableSorting: false,
            cell: ({ row }) => (row.eventLevelId ? t('admin-billing.sponsorships.configured') : '-')
        },
        {
            id: 'status',
            header: t('admin-billing.sponsorships.columns.status'),
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive
                        ? t('admin-billing.sponsorships.statuses.active')
                        : t('admin-billing.sponsorships.statuses.inactive')}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: t('admin-billing.sponsorships.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            toggleActiveMutation.mutate({ id: row.id, isActive: !row.isActive })
                        }
                        disabled={toggleActiveMutation.isPending}
                    >
                        {row.isActive
                            ? t('admin-billing.sponsorships.actions.deactivate')
                            : t('admin-billing.sponsorships.actions.activate')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                    >
                        {t('admin-billing.sponsorships.actions.edit')}
                    </Button>
                </div>
            )
        }
    ];

    if (error) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center">
                        <p className="text-muted-foreground">
                            {t('admin-billing.sponsorships.errors.loadPackages')}
                        </p>
                        <p className="mt-2 text-destructive text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const packages = (data?.items as SponsorshipPackage[] | undefined) ?? [];
    const total = (data?.pagination?.total as number | undefined) ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button>
                    <AddIcon className="mr-2 h-4 w-4" />
                    {t('admin-billing.sponsorships.create.package')}
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={packages}
                total={total}
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
    );
}
