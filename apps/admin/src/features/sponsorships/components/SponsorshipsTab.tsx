/**
 * Sponsorships Tab Component
 *
 * Displays and manages sponsorships in a data table with filtering.
 */
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CreateSponsorshipDialog } from '@/features/sponsorships/components/CreateSponsorshipDialog';
import {
    useSponsorshipsQuery,
    useUpdateSponsorshipStatusMutation
} from '@/features/sponsorships/hooks/useSponsorshipQueries';
import type { Sponsorship } from '@/features/sponsorships/types';
import { useTranslations } from '@/hooks/use-translations';
import { translateAdminApiError } from '@/lib/errors';
import type { ApiErrorShape } from '@repo/i18n';
import { AddIcon, CheckIcon, CloseIcon } from '@repo/icons';
import { LifecycleStatusEnum, SponsorshipStatusEnum } from '@repo/schemas';
import { useState } from 'react';

/**
 * Sponsorships Tab
 */
export function SponsorshipsTab() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        sponsorshipStatus?: string;
        targetType?: string;
        lifecycleState?: LifecycleStatusEnum;
    }>({});
    const [createOpen, setCreateOpen] = useState(false);

    const { data, isLoading, error } = useSponsorshipsQuery({
        page,
        pageSize,
        ...filters
    });

    const updateStatusMutation = useUpdateSponsorshipStatusMutation();

    const columns: DataTableColumn<Sponsorship>[] = [
        {
            id: 'sponsor',
            header: t('admin-billing.sponsorships.columns.sponsor'),
            accessorKey: 'sponsorUserId',
            enableSorting: false,
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
            id: 'target',
            header: t('admin-billing.sponsorships.columns.target'),
            accessorKey: 'targetId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'level',
            header: t('admin-billing.sponsorships.columns.level'),
            accessorKey: 'levelId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'sponsorshipStatus',
            header: t('admin-billing.sponsorships.columns.status'),
            accessorKey: 'sponsorshipStatus',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'pending',
                    label: t('admin-billing.sponsorships.statuses.pending'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'active',
                    label: t('admin-billing.sponsorships.statuses.active'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'expired',
                    label: t('admin-billing.sponsorships.statuses.expired'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'cancelled',
                    label: t('admin-billing.sponsorships.statuses.cancelled'),
                    color: BadgeColor.RED
                }
            ]
        },
        {
            id: 'lifecycleState',
            header: t('admin-billing.sponsorships.columns.lifecycleState'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: t('admin-billing.sponsorships.lifecycle.draft'),
                    color: BadgeColor.GRAY
                },
                {
                    value: LifecycleStatusEnum.ACTIVE,
                    label: t('admin-billing.sponsorships.lifecycle.active'),
                    color: BadgeColor.GREEN
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: t('admin-billing.sponsorships.lifecycle.archived'),
                    color: BadgeColor.YELLOW
                }
            ]
        },
        {
            id: 'startsAt',
            header: t('admin-billing.sponsorships.columns.startsAt'),
            accessorKey: 'startsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'endsAt',
            header: t('admin-billing.sponsorships.columns.endsAt'),
            accessorKey: 'endsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'actions',
            header: t('admin-billing.sponsorships.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {row.sponsorshipStatus === SponsorshipStatusEnum.PENDING && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                updateStatusMutation.mutate({
                                    id: row.id,
                                    sponsorshipStatus: SponsorshipStatusEnum.ACTIVE
                                })
                            }
                            disabled={updateStatusMutation.isPending}
                        >
                            <CheckIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.sponsorships.actions.approve')}
                        </Button>
                    )}
                    {(row.sponsorshipStatus === SponsorshipStatusEnum.PENDING ||
                        row.sponsorshipStatus === SponsorshipStatusEnum.ACTIVE) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                updateStatusMutation.mutate({
                                    id: row.id,
                                    sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
                                })
                            }
                            disabled={updateStatusMutation.isPending}
                        >
                            <CloseIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.sponsorships.actions.cancel')}
                        </Button>
                    )}
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
                            {t('admin-billing.sponsorships.errors.loadSponsorships')}
                        </p>
                        <p className="mt-2 text-destructive text-sm">
                            {translateAdminApiError({ error: error as ApiErrorShape, t })}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const sponsorships = (data?.items as Sponsorship[] | undefined) ?? [];
    const total = (data?.pagination?.total as number | undefined) ?? 0;

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                    <select
                        aria-label={t('admin-billing.sponsorships.filters.allStatuses')}
                        className="rounded-md border px-3 py-2 text-sm"
                        value={filters.sponsorshipStatus || 'all'}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                sponsorshipStatus:
                                    e.target.value === 'all' ? undefined : e.target.value
                            }))
                        }
                    >
                        <option value="all">
                            {t('admin-billing.sponsorships.filters.allStatuses')}
                        </option>
                        <option value={SponsorshipStatusEnum.PENDING}>
                            {t('admin-billing.sponsorships.statuses.pending')}
                        </option>
                        <option value={SponsorshipStatusEnum.ACTIVE}>
                            {t('admin-billing.sponsorships.statuses.active')}
                        </option>
                        <option value={SponsorshipStatusEnum.EXPIRED}>
                            {t('admin-billing.sponsorships.statuses.expired')}
                        </option>
                        <option value={SponsorshipStatusEnum.CANCELLED}>
                            {t('admin-billing.sponsorships.statuses.cancelled')}
                        </option>
                    </select>

                    <select
                        aria-label={t('admin-billing.sponsorships.filters.allTypes')}
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
                            {t('admin-billing.sponsorships.filters.allTypes')}
                        </option>
                        <option value="EVENT">
                            {t('admin-billing.sponsorships.targetTypes.event')}
                        </option>
                        <option value="POST">
                            {t('admin-billing.sponsorships.targetTypes.post')}
                        </option>
                    </select>

                    <select
                        aria-label={t('admin-billing.sponsorships.filters.allLifecycle')}
                        className="rounded-md border px-3 py-2 text-sm"
                        value={filters.lifecycleState || 'all'}
                        onChange={(e) =>
                            setFilters((prev) => ({
                                ...prev,
                                lifecycleState:
                                    e.target.value === 'all'
                                        ? undefined
                                        : (e.target.value as LifecycleStatusEnum)
                            }))
                        }
                    >
                        <option value="all">
                            {t('admin-billing.sponsorships.filters.allLifecycle')}
                        </option>
                        <option value={LifecycleStatusEnum.DRAFT}>
                            {t('admin-billing.sponsorships.lifecycle.draft')}
                        </option>
                        <option value={LifecycleStatusEnum.ACTIVE}>
                            {t('admin-billing.sponsorships.lifecycle.active')}
                        </option>
                        <option value={LifecycleStatusEnum.ARCHIVED}>
                            {t('admin-billing.sponsorships.lifecycle.archived')}
                        </option>
                    </select>
                </div>

                <Button onClick={() => setCreateOpen(true)}>
                    <AddIcon className="mr-2 h-4 w-4" />
                    {t('admin-billing.sponsorships.create.sponsorship')}
                </Button>
            </div>

            <CreateSponsorshipDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />

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
        </div>
    );
}
