/**
 * Sponsor Sponsorships List
 *
 * View and manage sponsor's own sponsorships
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useSponsorSponsorshipsQuery } from '@/features/sponsor-dashboard/hooks';
import type { SponsorSponsorship } from '@/features/sponsor-dashboard/types';
import { useTranslations } from '@/hooks/use-translations';
import { formatShortDate } from '@/lib/format-helpers';
import { formatNumber } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/sponsor/sponsorships')({
    component: SponsorSponsorshipsPage
});

function SponsorSponsorshipsPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        status?: string;
        targetType?: string;
    }>({});
    const [selectedSponsorship, setSelectedSponsorship] = useState<SponsorSponsorship | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    const { data, isLoading, error } = useSponsorSponsorshipsQuery({
        page,
        pageSize,
        ...filters
    });

    const handleViewDetails = (sponsorship: SponsorSponsorship) => {
        setSelectedSponsorship(sponsorship);
        setDetailDialogOpen(true);
    };

    const columns: DataTableColumn<SponsorSponsorship>[] = [
        {
            id: 'targetType',
            header: t('admin-pages.sponsor.sponsorships.colType'),
            accessorKey: 'targetType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'EVENT',
                    label: t('admin-pages.sponsor.sponsorships.typeEvent'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'POST',
                    label: t('admin-pages.sponsor.sponsorships.typePost'),
                    color: BadgeColor.PURPLE
                }
            ]
        },
        {
            id: 'targetName',
            header: t('admin-pages.sponsor.sponsorships.colTarget'),
            accessorKey: 'targetName',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'levelTier',
            header: t('admin-pages.sponsor.sponsorships.colLevel'),
            accessorKey: 'levelTier',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'BRONZE',
                    label: t('admin-pages.sponsor.sponsorships.levelBronze'),
                    color: BadgeColor.ORANGE
                },
                {
                    value: 'SILVER',
                    label: t('admin-pages.sponsor.sponsorships.levelSilver'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'GOLD',
                    label: t('admin-pages.sponsor.sponsorships.levelGold'),
                    color: BadgeColor.YELLOW
                }
            ]
        },
        {
            id: 'status',
            header: t('admin-pages.sponsor.sponsorships.colStatus'),
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'PENDING',
                    label: t('admin-pages.sponsor.sponsorships.statusPending'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'ACTIVE',
                    label: t('admin-pages.sponsor.sponsorships.statusActive'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'EXPIRED',
                    label: t('admin-pages.sponsor.sponsorships.statusExpired'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'CANCELLED',
                    label: t('admin-pages.sponsor.sponsorships.statusCancelled'),
                    color: BadgeColor.RED
                }
            ]
        },
        {
            id: 'startsAt',
            header: t('admin-pages.sponsor.sponsorships.colStart'),
            accessorKey: 'startsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'endsAt',
            header: t('admin-pages.sponsor.sponsorships.colEnd'),
            accessorKey: 'endsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'impressions',
            header: t('admin-pages.sponsor.sponsorships.colImpressions'),
            accessorKey: 'impressions',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'clicks',
            header: t('admin-pages.sponsor.sponsorships.colClicks'),
            accessorKey: 'clicks',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'actions',
            header: t('admin-pages.sponsor.sponsorships.colActions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(row)}
                >
                    {t('admin-pages.sponsor.sponsorships.viewDetails')}
                </Button>
            )
        }
    ];

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                {t('admin-pages.sponsor.sponsorships.loadError')}
                            </p>
                            <p className="mt-2 text-destructive text-sm">{error.message}</p>
                        </div>
                    </CardContent>
                </Card>
            </SidebarPageLayout>
        );
    }

    const sponsorships = data?.items || [];
    const total = data?.pagination?.total || 0;

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.sponsor.sponsorships.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.sponsor.sponsorships.subtitle')}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    <select
                        className="rounded-md border px-3 py-2 text-sm"
                        value={filters.status || 'all'}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                status: e.target.value === 'all' ? undefined : e.target.value
                            }))
                        }
                    >
                        <option value="all">
                            {t('admin-pages.sponsor.sponsorships.filterAllStatuses')}
                        </option>
                        <option value="PENDING">
                            {t('admin-pages.sponsor.sponsorships.statusPending')}
                        </option>
                        <option value="ACTIVE">
                            {t('admin-pages.sponsor.sponsorships.statusActive')}
                        </option>
                        <option value="EXPIRED">
                            {t('admin-pages.sponsor.sponsorships.statusExpired')}
                        </option>
                        <option value="CANCELLED">
                            {t('admin-pages.sponsor.sponsorships.statusCancelled')}
                        </option>
                    </select>

                    <select
                        className="rounded-md border px-3 py-2 text-sm"
                        value={filters.targetType || 'all'}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                targetType: e.target.value === 'all' ? undefined : e.target.value
                            }))
                        }
                    >
                        <option value="all">
                            {t('admin-pages.sponsor.sponsorships.filterAllTypes')}
                        </option>
                        <option value="EVENT">
                            {t('admin-pages.sponsor.sponsorships.typeEvent')}
                        </option>
                        <option value="POST">
                            {t('admin-pages.sponsor.sponsorships.typePost')}
                        </option>
                    </select>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={sponsorships}
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

                {/* Detail Dialog */}
                <SponsorshipDetailDialog
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    sponsorship={selectedSponsorship}
                />
            </div>
        </SidebarPageLayout>
    );
}

/**
 * Sponsorship Detail Dialog
 */
function SponsorshipDetailDialog({
    open,
    onOpenChange,
    sponsorship
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sponsorship: SponsorSponsorship | null;
}) {
    const { t, locale } = useTranslations();
    if (!sponsorship) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{sponsorship.targetName}</DialogTitle>
                    <DialogDescription>
                        {t('admin-pages.sponsor.sponsorships.dialog.details')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                {t('admin-pages.sponsor.sponsorships.dialog.status')}
                            </span>
                            <Badge
                                variant={sponsorship.status === 'ACTIVE' ? 'success' : 'secondary'}
                            >
                                {sponsorship.status}
                            </Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                {t('admin-pages.sponsor.sponsorships.dialog.type')}
                            </span>
                            <span>{sponsorship.targetType}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                {t('admin-pages.sponsor.sponsorships.dialog.level')}
                            </span>
                            <span>{sponsorship.levelTier}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                {t('admin-pages.sponsor.sponsorships.dialog.period')}
                            </span>
                            <span>
                                {formatShortDate({ date: sponsorship.startsAt, locale })} -{' '}
                                {formatShortDate({ date: sponsorship.endsAt, locale })}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-md border bg-muted p-4">
                        <h4 className="mb-3 font-semibold text-sm">
                            {t('admin-pages.sponsor.sponsorships.dialog.metrics')}
                        </h4>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.sponsor.sponsorships.dialog.impressions')}
                                </span>
                                <span className="font-medium">
                                    {formatNumber({
                                        value: sponsorship.impressions,
                                        locale
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.sponsor.sponsorships.dialog.clicks')}
                                </span>
                                <span className="font-medium">
                                    {formatNumber({ value: sponsorship.clicks, locale })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.sponsor.sponsorships.dialog.ctr')}
                                </span>
                                <span className="font-medium">
                                    {sponsorship.impressions > 0
                                        ? formatNumber({
                                              value:
                                                  (sponsorship.clicks / sponsorship.impressions) *
                                                  100,
                                              locale,
                                              options: {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2
                                              }
                                          })
                                        : formatNumber({ value: 0, locale })}
                                    %
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-pages.sponsor.sponsorships.dialog.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
