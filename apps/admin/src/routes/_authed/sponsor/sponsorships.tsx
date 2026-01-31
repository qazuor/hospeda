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
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/sponsor/sponsorships')({
    component: SponsorSponsorshipsPage
});

function SponsorSponsorshipsPage() {
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
        limit: pageSize,
        ...filters
    });

    const handleViewDetails = (sponsorship: SponsorSponsorship) => {
        setSelectedSponsorship(sponsorship);
        setDetailDialogOpen(true);
    };

    const columns: DataTableColumn<SponsorSponsorship>[] = [
        {
            id: 'targetType',
            header: 'Tipo',
            accessorKey: 'targetType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'EVENT', label: 'Evento', color: BadgeColor.BLUE },
                { value: 'POST', label: 'Publicación', color: BadgeColor.PURPLE }
            ]
        },
        {
            id: 'targetName',
            header: 'Objetivo',
            accessorKey: 'targetName',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'levelTier',
            header: 'Nivel',
            accessorKey: 'levelTier',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'BRONZE', label: 'Bronce', color: BadgeColor.ORANGE },
                { value: 'SILVER', label: 'Plata', color: BadgeColor.GRAY },
                { value: 'GOLD', label: 'Oro', color: BadgeColor.YELLOW }
            ]
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'PENDING', label: 'Pendiente', color: BadgeColor.YELLOW },
                { value: 'ACTIVE', label: 'Activo', color: BadgeColor.GREEN },
                { value: 'EXPIRED', label: 'Expirado', color: BadgeColor.GRAY },
                { value: 'CANCELLED', label: 'Cancelado', color: BadgeColor.RED }
            ]
        },
        {
            id: 'startsAt',
            header: 'Inicio',
            accessorKey: 'startsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'endsAt',
            header: 'Fin',
            accessorKey: 'endsAt',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'impressions',
            header: 'Impresiones',
            accessorKey: 'impressions',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'clicks',
            header: 'Clicks',
            accessorKey: 'clicks',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'actions',
            header: 'Acciones',
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(row)}
                >
                    Ver detalles
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
                                No se pudieron cargar los patrocinios. Verifica que la API esté
                                funcionando.
                            </p>
                            <p className="mt-2 text-red-600 text-sm">{error.message}</p>
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
                    <h2 className="mb-2 font-bold text-2xl">Mis Patrocinios</h2>
                    <p className="text-muted-foreground">
                        Visualiza y gestiona tus patrocinios activos
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
                        <option value="all">Todos los estados</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="ACTIVE">Activo</option>
                        <option value="EXPIRED">Expirado</option>
                        <option value="CANCELLED">Cancelado</option>
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
                        <option value="all">Todos los tipos</option>
                        <option value="EVENT">Evento</option>
                        <option value="POST">Publicación</option>
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
    if (!sponsorship) return null;

    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{sponsorship.targetName}</DialogTitle>
                    <DialogDescription>Detalles del patrocinio</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estado:</span>
                            <Badge
                                variant={sponsorship.status === 'ACTIVE' ? 'success' : 'secondary'}
                            >
                                {sponsorship.status}
                            </Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span>{sponsorship.targetType}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nivel:</span>
                            <span>{sponsorship.levelTier}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Período:</span>
                            <span>
                                {formatDate(sponsorship.startsAt)} -{' '}
                                {formatDate(sponsorship.endsAt)}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-md border bg-muted p-4">
                        <h4 className="mb-3 font-semibold text-sm">Métricas</h4>
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Impresiones:</span>
                                <span className="font-medium">
                                    {sponsorship.impressions.toLocaleString('es-AR')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Clicks:</span>
                                <span className="font-medium">
                                    {sponsorship.clicks.toLocaleString('es-AR')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CTR:</span>
                                <span className="font-medium">
                                    {sponsorship.impressions > 0
                                        ? (
                                              (sponsorship.clicks / sponsorship.impressions) *
                                              100
                                          ).toFixed(2)
                                        : 0}
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
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
