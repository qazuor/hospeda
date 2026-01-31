/**
 * Owner Promotions Management Page
 *
 * Manages special promotions offered by accommodation owners
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { DataTable } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateOwnerPromotionMutation,
    useDeleteOwnerPromotionMutation,
    useOwnerPromotionsQuery,
    useTogglePromotionActiveMutation,
    useUpdateOwnerPromotionMutation
} from '@/features/owner-promotions/hooks';
import type { CreateOwnerPromotionInput, OwnerPromotion } from '@/features/owner-promotions/types';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/owner-promotions')({
    component: BillingOwnerPromotionsPage
});

function BillingOwnerPromotionsPage() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState<{
        status?: string;
        discountType?: string;
    }>({});
    const [selectedPromotion, setSelectedPromotion] = useState<OwnerPromotion | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);

    const { data, isLoading, error } = useOwnerPromotionsQuery({
        page,
        limit: pageSize,
        ...filters
    });

    const toggleActiveMutation = useTogglePromotionActiveMutation();
    const deleteMutation = useDeleteOwnerPromotionMutation();

    const handleToggleActive = (promotion: OwnerPromotion) => {
        toggleActiveMutation.mutate({
            id: promotion.id,
            isActive: !promotion.isActive
        });
    };

    const handleEdit = (promotion: OwnerPromotion) => {
        setSelectedPromotion(promotion);
        setEditDialogOpen(true);
    };

    const handleDelete = (promotion: OwnerPromotion) => {
        if (confirm(`¿Estás seguro de eliminar la promoción "${promotion.title}"?`)) {
            deleteMutation.mutate(promotion.id);
        }
    };

    const handleViewDetails = (promotion: OwnerPromotion) => {
        setSelectedPromotion(promotion);
        setDetailDialogOpen(true);
    };

    const columns: DataTableColumn<OwnerPromotion>[] = [
        {
            id: 'title',
            header: 'Título',
            accessorKey: 'title',
            enableSorting: true,
            columnType: ColumnType.STRING
        },
        {
            id: 'ownerId',
            header: 'Propietario',
            accessorKey: 'ownerId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'accommodationId',
            header: 'Alojamiento',
            accessorKey: 'accommodationId',
            enableSorting: false,
            columnType: ColumnType.STRING
        },
        {
            id: 'discountType',
            header: 'Tipo',
            accessorKey: 'discountType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'PERCENTAGE', label: 'Porcentaje', color: BadgeColor.BLUE },
                { value: 'FIXED_AMOUNT', label: 'Monto fijo', color: BadgeColor.GREEN },
                { value: 'FREE_NIGHT', label: 'Noche gratis', color: BadgeColor.PURPLE },
                { value: 'SPECIAL_PRICE', label: 'Precio especial', color: BadgeColor.ORANGE }
            ]
        },
        {
            id: 'discountValue',
            header: 'Valor',
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.NUMBER
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
            id: 'validFrom',
            header: 'Inicio',
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'validUntil',
            header: 'Fin',
            accessorKey: 'validUntil',
            enableSorting: true,
            columnType: ColumnType.DATE
        },
        {
            id: 'redemptions',
            header: 'Uso',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.currentRedemptions} / {row.maxRedemptions || '∞'}
                </span>
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
                        onClick={() => handleViewDetails(row)}
                    >
                        Ver
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(row)}
                        disabled={toggleActiveMutation.isPending}
                    >
                        {row.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(row)}
                    >
                        Editar
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(row)}
                        disabled={deleteMutation.isPending}
                    >
                        Eliminar
                    </Button>
                </div>
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
                                No se pudieron cargar las promociones. Verifica que la API esté
                                funcionando.
                            </p>
                            <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                        </div>
                    </CardContent>
                </Card>
            </SidebarPageLayout>
        );
    }

    const promotions = data?.items || [];
    const total = data?.pagination?.total || 0;

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Promociones de Propietarios</h2>
                    <p className="text-muted-foreground">
                        Gestiona promociones especiales ofrecidas por propietarios de alojamientos
                    </p>
                </div>

                {/* Filters and actions */}
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
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={filters.discountType || 'all'}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    discountType:
                                        e.target.value === 'all' ? undefined : e.target.value
                                }))
                            }
                        >
                            <option value="all">Todos los tipos</option>
                            <option value="PERCENTAGE">Porcentaje</option>
                            <option value="FIXED_AMOUNT">Monto fijo</option>
                            <option value="FREE_NIGHT">Noche gratis</option>
                            <option value="SPECIAL_PRICE">Precio especial</option>
                        </select>
                    </div>

                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear promoción
                    </Button>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={promotions}
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

                {/* Dialogs */}
                <PromotionFormDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    promotion={null}
                    mode="create"
                />

                <PromotionFormDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    promotion={selectedPromotion}
                    mode="edit"
                />

                <PromotionDetailDialog
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    promotion={selectedPromotion}
                />
            </div>
        </SidebarPageLayout>
    );
}

/**
 * Promotion Form Dialog (Create/Edit)
 */
function PromotionFormDialog({
    open,
    onOpenChange,
    promotion,
    mode
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    promotion: OwnerPromotion | null;
    mode: 'create' | 'edit';
}) {
    const [formData, setFormData] = useState<CreateOwnerPromotionInput>({
        ownerId: promotion?.ownerId || '',
        accommodationId: promotion?.accommodationId || '',
        title: promotion?.title || '',
        description: promotion?.description || '',
        discountType: promotion?.discountType || 'PERCENTAGE',
        discountValue: promotion?.discountValue || 0,
        minNights: promotion?.minNights || undefined,
        validFrom: promotion?.validFrom || '',
        validUntil: promotion?.validUntil || '',
        maxRedemptions: promotion?.maxRedemptions || undefined,
        isActive: promotion?.isActive ?? true
    });

    const createMutation = useCreateOwnerPromotionMutation();
    const updateMutation = useUpdateOwnerPromotionMutation();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'create') {
            createMutation.mutate(formData, {
                onSuccess: () => {
                    onOpenChange(false);
                }
            });
        } else if (promotion) {
            updateMutation.mutate(
                { ...formData, id: promotion.id },
                {
                    onSuccess: () => {
                        onOpenChange(false);
                    }
                }
            );
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Crear promoción' : 'Editar promoción'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Completa los datos para crear una nueva promoción'
                            : 'Modifica los datos de la promoción'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Título *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                                }
                                required
                                placeholder="Nombre de la promoción"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: e.target.value
                                    }))
                                }
                                rows={3}
                                placeholder="Descripción opcional de la promoción"
                            />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="discountType">Tipo de descuento *</Label>
                                <select
                                    id="discountType"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.discountType}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountType: e.target.value as
                                                | 'PERCENTAGE'
                                                | 'FIXED_AMOUNT'
                                                | 'FREE_NIGHT'
                                                | 'SPECIAL_PRICE'
                                        }))
                                    }
                                >
                                    <option value="PERCENTAGE">Porcentaje</option>
                                    <option value="FIXED_AMOUNT">Monto fijo</option>
                                    <option value="FREE_NIGHT">Noche gratis</option>
                                    <option value="SPECIAL_PRICE">Precio especial</option>
                                </select>
                            </div>

                            <div>
                                <Label htmlFor="discountValue">Valor *</Label>
                                <Input
                                    id="discountValue"
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountValue: Number(e.target.value)
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="validFrom">Válido desde *</Label>
                                <Input
                                    id="validFrom"
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validFrom: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="validUntil">Válido hasta *</Label>
                                <Input
                                    id="validUntil"
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validUntil: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit">{mode === 'create' ? 'Crear' : 'Guardar'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Promotion Detail Dialog
 */
function PromotionDetailDialog({
    open,
    onOpenChange,
    promotion
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    promotion: OwnerPromotion | null;
}) {
    if (!promotion) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{promotion.title}</DialogTitle>
                    <DialogDescription>Detalles de la promoción</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Información general</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Estado:</span>
                                <Badge variant={promotion.isActive ? 'success' : 'secondary'}>
                                    {promotion.isActive ? 'Activo' : 'Inactivo'}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo de descuento:</span>
                                <span>{promotion.discountType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor:</span>
                                <span>{promotion.discountValue}</span>
                            </div>
                            {promotion.description && (
                                <div>
                                    <p className="mb-1 text-muted-foreground">Descripción:</p>
                                    <p>{promotion.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Estadísticas de uso</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Canjes actuales:</span>
                                <span>{promotion.currentRedemptions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Canjes máximos:</span>
                                <span>{promotion.maxRedemptions || 'Ilimitado'}</span>
                            </div>
                        </CardContent>
                    </Card>
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
