/**
 * Sponsorship Levels Tab Component
 *
 * Displays and manages sponsorship levels in a data table.
 */
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    useSponsorshipLevelsQuery,
    useToggleLevelActiveMutation
} from '@/features/sponsorships/hooks/useSponsorshipQueries';
import type { SponsorshipLevel } from '@/features/sponsorships/types';
import { useTranslations } from '@/hooks/use-translations';
import { formatCurrency } from '@repo/i18n';
import { AddIcon } from '@repo/icons';
import { useState } from 'react';

/**
 * Sponsorship Levels Tab
 */
export function SponsorshipLevelsTab() {
    const { t, locale } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipLevelsQuery({
        page,
        pageSize
    });

    const toggleActiveMutation = useToggleLevelActiveMutation();

    const formatPrice = (amount: number) => {
        return formatCurrency({ value: amount, locale, currency: 'ARS' });
    };

    const columns: DataTableColumn<SponsorshipLevel>[] = [
        {
            id: 'name',
            header: t('admin-billing.sponsorships.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'targetType',
            header: t('admin-billing.sponsorships.columns.type'),
            accessorKey: 'targetType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'EVENT',
                    label: t('admin-billing.sponsorships.targetTypes.event'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'POST',
                    label: t('admin-billing.sponsorships.targetTypes.post'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'tier',
            header: t('admin-billing.sponsorships.columns.level'),
            accessorKey: 'tier',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'BRONZE',
                    label: t('admin-billing.sponsorships.tiers.bronze'),
                    color: BadgeColor.ORANGE
                },
                {
                    value: 'SILVER',
                    label: t('admin-billing.sponsorships.tiers.silver'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'GOLD',
                    label: t('admin-billing.sponsorships.tiers.gold'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'STANDARD',
                    label: t('admin-billing.sponsorships.tiers.standard'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'PREMIUM',
                    label: t('admin-billing.sponsorships.tiers.premium'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'price',
            header: t('admin-billing.sponsorships.columns.price'),
            enableSorting: true,
            cell: ({ row }) => <span className="font-medium">{formatPrice(row.priceAmount)}</span>
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
                            {t('admin-billing.sponsorships.errors.loadLevels')}
                        </p>
                        <p className="mt-2 text-destructive text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const levels = (data?.items as SponsorshipLevel[] | undefined) ?? [];
    const total = (data?.pagination?.total as number | undefined) ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button>
                    <AddIcon className="mr-2 h-4 w-4" />
                    {t('admin-billing.sponsorships.create.level')}
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={levels}
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
