/**
 * Sponsorships Management Page
 *
 * Manages sponsorships, sponsorship levels, and sponsorship packages in a tabbed interface.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    useSponsorshipLevelsQuery,
    useSponsorshipPackagesQuery,
    useSponsorshipsQuery,
    useToggleLevelActiveMutation,
    useTogglePackageActiveMutation,
    useUpdateSponsorshipStatusMutation
} from '@/features/sponsorships/hooks/useSponsorshipQueries';
import type {
    Sponsorship,
    SponsorshipLevel,
    SponsorshipPackage
} from '@/features/sponsorships/types';
import { useTranslations } from '@/hooks/use-translations';
import { AddIcon, CheckIcon, CloseIcon } from '@repo/icons';
import { SponsorshipStatusEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/sponsorships')({
    component: BillingSponsorshipsPage
});

type TabId = 'sponsorships' | 'levels' | 'packages';

function BillingSponsorshipsPage() {
    const { t } = useTranslations();
    const [activeTab, setActiveTab] = useState<TabId>('sponsorships');

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.sponsorships.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.sponsorships.description')}
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b">
                    <nav
                        className="flex gap-4"
                        role="tablist"
                    >
                        <TabButton
                            id="sponsorships"
                            label={t('admin-billing.sponsorships.tabs.sponsorships')}
                            isActive={activeTab === 'sponsorships'}
                            onClick={() => setActiveTab('sponsorships')}
                        />
                        <TabButton
                            id="levels"
                            label={t('admin-billing.sponsorships.tabs.levels')}
                            isActive={activeTab === 'levels'}
                            onClick={() => setActiveTab('levels')}
                        />
                        <TabButton
                            id="packages"
                            label={t('admin-billing.sponsorships.tabs.packages')}
                            isActive={activeTab === 'packages'}
                            onClick={() => setActiveTab('packages')}
                        />
                    </nav>
                </div>

                {/* Tab content */}
                <div>
                    {activeTab === 'sponsorships' && <SponsorshipsTab />}
                    {activeTab === 'levels' && <SponsorshipLevelsTab />}
                    {activeTab === 'packages' && <SponsorshipPackagesTab />}
                </div>
            </div>
        </SidebarPageLayout>
    );
}

interface TabButtonProps {
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

function TabButton({ id, label, isActive, onClick }: TabButtonProps) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            data-tab-id={id}
            onClick={onClick}
            className={`relative whitespace-nowrap px-1 py-3 font-medium text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            } after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:transition-colors ${
                isActive ? 'after:bg-primary' : 'after:bg-transparent hover:after:bg-border'
            }`}
        >
            {label}
        </button>
    );
}

/**
 * Sponsorships Tab
 */
function SponsorshipsTab() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        status?: string;
        targetType?: string;
    }>({});

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
            id: 'status',
            header: t('admin-billing.sponsorships.columns.status'),
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'PENDING',
                    label: t('admin-billing.sponsorships.statuses.pending'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'ACTIVE',
                    label: t('admin-billing.sponsorships.statuses.active'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'EXPIRED',
                    label: t('admin-billing.sponsorships.statuses.expired'),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'CANCELLED',
                    label: t('admin-billing.sponsorships.statuses.cancelled'),
                    color: BadgeColor.RED
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
                    {row.status === SponsorshipStatusEnum.PENDING && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                updateStatusMutation.mutate({
                                    id: row.id,
                                    status: SponsorshipStatusEnum.ACTIVE
                                })
                            }
                            disabled={updateStatusMutation.isPending}
                        >
                            <CheckIcon className="mr-1 h-3 w-3" />
                            {t('admin-billing.sponsorships.actions.approve')}
                        </Button>
                    )}
                    {(row.status === SponsorshipStatusEnum.PENDING ||
                        row.status === SponsorshipStatusEnum.ACTIVE) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                updateStatusMutation.mutate({
                                    id: row.id,
                                    status: SponsorshipStatusEnum.CANCELLED
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
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
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
                </div>

                <Button>
                    <AddIcon className="mr-2 h-4 w-4" />
                    {t('admin-billing.sponsorships.create.sponsorship')}
                </Button>
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
        </div>
    );
}

/**
 * Sponsorship Levels Tab
 */
function SponsorshipLevelsTab() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipLevelsQuery({
        page,
        pageSize
    });

    const toggleActiveMutation = useToggleLevelActiveMutation();

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
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
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
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

/**
 * Sponsorship Packages Tab
 */
function SponsorshipPackagesTab() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipPackagesQuery({
        page,
        pageSize
    });

    const toggleActiveMutation = useTogglePackageActiveMutation();

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
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
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
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
