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
import { SponsorshipStatusEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/sponsorships')({
    component: BillingSponsorshipsPage
});

type TabId = 'sponsorships' | 'levels' | 'packages';

function BillingSponsorshipsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('sponsorships');

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Patrocinios</h2>
                    <p className="text-muted-foreground">
                        Gestiona patrocinios, niveles y paquetes de suscripción
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
                            label="Patrocinios"
                            isActive={activeTab === 'sponsorships'}
                            onClick={() => setActiveTab('sponsorships')}
                        />
                        <TabButton
                            id="levels"
                            label="Niveles"
                            isActive={activeTab === 'levels'}
                            onClick={() => setActiveTab('levels')}
                        />
                        <TabButton
                            id="packages"
                            label="Paquetes"
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        status?: string;
        targetType?: string;
    }>({});

    const { data, isLoading, error } = useSponsorshipsQuery({
        page,
        limit: pageSize,
        ...filters
    });

    const updateStatusMutation = useUpdateSponsorshipStatusMutation();

    const columns: DataTableColumn<Sponsorship>[] = [
        {
            id: 'sponsor',
            header: 'Patrocinador',
            accessorKey: 'sponsorUserId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
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
            id: 'target',
            header: 'Objetivo',
            accessorKey: 'targetId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'level',
            header: 'Nivel',
            accessorKey: 'levelId',
            enableSorting: false,
            columnType: ColumnType.STRING
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
            id: 'actions',
            header: 'Acciones',
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
                            <Check className="mr-1 h-3 w-3" />
                            Aprobar
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
                            <X className="mr-1 h-3 w-3" />
                            Cancelar
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
                            No se pudieron cargar los patrocinios. Verifica que la API esté
                            funcionando.
                        </p>
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const sponsorships = data?.items || [];
    const total = data?.pagination?.total || 0;

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
                        <option value="all">Todos los estados</option>
                        <option value={SponsorshipStatusEnum.PENDING}>Pendiente</option>
                        <option value={SponsorshipStatusEnum.ACTIVE}>Activo</option>
                        <option value={SponsorshipStatusEnum.EXPIRED}>Expirado</option>
                        <option value={SponsorshipStatusEnum.CANCELLED}>Cancelado</option>
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

                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear patrocinio
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipLevelsQuery({
        page,
        limit: pageSize
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
            header: 'Nombre',
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
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
            id: 'tier',
            header: 'Nivel',
            accessorKey: 'tier',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'BRONZE', label: 'Bronce', color: BadgeColor.ORANGE },
                { value: 'SILVER', label: 'Plata', color: BadgeColor.GRAY },
                { value: 'GOLD', label: 'Oro', color: BadgeColor.YELLOW },
                { value: 'STANDARD', label: 'Estándar', color: BadgeColor.BLUE },
                { value: 'PREMIUM', label: 'Premium', color: BadgeColor.PURPLE }
            ]
        },
        {
            id: 'price',
            header: 'Precio',
            enableSorting: true,
            cell: ({ row }) => <span className="font-medium">{formatPrice(row.priceAmount)}</span>
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: 'Acciones',
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
                        {row.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                    >
                        Editar
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
                            No se pudieron cargar los niveles. Verifica que la API esté funcionando.
                        </p>
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const levels = data?.items || [];
    const total = data?.pagination?.total || 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear nivel
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data, isLoading, error } = useSponsorshipPackagesQuery({
        page,
        limit: pageSize
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
            header: 'Nombre',
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'price',
            header: 'Precio/mes',
            enableSorting: true,
            cell: ({ row }) => <span className="font-medium">{formatPrice(row.priceAmount)}</span>
        },
        {
            id: 'includedPosts',
            header: 'Posts incluidos',
            accessorKey: 'includedPosts',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'includedEvents',
            header: 'Eventos incluidos',
            accessorKey: 'includedEvents',
            enableSorting: true,
            columnType: ColumnType.NUMBER
        },
        {
            id: 'eventLevel',
            header: 'Nivel de evento',
            accessorKey: 'eventLevelId',
            enableSorting: false,
            cell: ({ row }) => (row.eventLevelId ? 'Configurado' : '-')
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <Badge variant={row.isActive ? 'success' : 'secondary'}>
                    {row.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
            )
        },
        {
            id: 'actions',
            header: 'Acciones',
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
                        {row.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                    >
                        Editar
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
                            No se pudieron cargar los paquetes. Verifica que la API esté
                            funcionando.
                        </p>
                        <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const packages = data?.items || [];
    const total = data?.pagination?.total || 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear paquete
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
