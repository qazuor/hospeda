/**
 * Promo Codes Management Page
 *
 * Manages promotional discount codes for subscription plans.
 * Supports creating, editing, activating/deactivating, and deleting promo codes.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    type CreatePromoCodePayload,
    type DiscountType,
    type PlanCategory,
    type PromoCode,
    type PromoCodeStatus,
    getPromoCodeColumns,
    useCreatePromoCodeMutation,
    useDeletePromoCodeMutation,
    usePromoCodesQuery,
    useTogglePromoCodeActiveMutation,
    useUpdatePromoCodeMutation
} from '@/features/promo-codes';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/promo-codes')({
    component: BillingPromoCodesPage
});

/**
 * Create/Edit Dialog Component
 */
function PromoCodeFormDialog({
    promoCode,
    isOpen,
    onClose,
    onSubmit
}: {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (data: CreatePromoCodePayload) => void;
}) {
    const isEdit = !!promoCode;

    const [formData, setFormData] = useState<CreatePromoCodePayload>({
        code: promoCode?.code || '',
        description: promoCode?.description || '',
        type: promoCode?.type || 'percentage',
        discountValue: promoCode?.discountValue || 0,
        maxUses: promoCode?.maxUses || null,
        maxUsesPerUser: promoCode?.maxUsesPerUser || null,
        validFrom: promoCode?.validFrom || new Date(),
        validUntil: promoCode?.validUntil || null,
        applicablePlans: promoCode?.applicablePlans
            ? [...promoCode.applicablePlans]
            : ['owner', 'complex', 'tourist'],
        isStackable: promoCode?.isStackable || false,
        isActive: promoCode?.isActive ?? true,
        requiresFirstPurchase: promoCode?.requiresFirstPurchase || false,
        minimumAmount: promoCode?.minimumAmount || null
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Convert code to uppercase
        const payload = {
            ...formData,
            code: formData.code.toUpperCase()
        };

        onSubmit(payload);
    };

    const handlePlanToggle = (plan: PlanCategory) => {
        const currentPlans = formData.applicablePlans;
        const newPlans = currentPlans.includes(plan)
            ? currentPlans.filter((p) => p !== plan)
            : [...currentPlans, plan];

        setFormData({ ...formData, applicablePlans: newPlans });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Editar código promocional' : 'Crear código promocional'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Modifica los datos del código promocional'
                            : 'Completa los datos para crear un nuevo código'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Code */}
                    <div className="space-y-2">
                        <Label htmlFor="code">Código *</Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                                setFormData({ ...formData, code: e.target.value.toUpperCase() })
                            }
                            placeholder="LANZAMIENTO50"
                            className="font-mono uppercase"
                            required
                            disabled={isEdit}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción *</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder="50% de descuento por lanzamiento"
                            required
                        />
                    </div>

                    {/* Type and Value */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">Tipo de descuento *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, type: value as DiscountType })
                                }
                            >
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">Porcentaje</SelectItem>
                                    <SelectItem value="fixed">Monto Fijo (ARS)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="discountValue">
                                Valor *{' '}
                                {formData.type === 'percentage' ? '(%)' : '(ARS, en centavos)'}
                            </Label>
                            <Input
                                id="discountValue"
                                type="number"
                                value={formData.discountValue}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        discountValue: Number(e.target.value)
                                    })
                                }
                                min={0}
                                max={formData.type === 'percentage' ? 100 : undefined}
                                required
                            />
                        </div>
                    </div>

                    {/* Usage limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxUses">Usos máximos totales</Label>
                            <Input
                                id="maxUses"
                                type="number"
                                value={formData.maxUses || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUses: e.target.value ? Number(e.target.value) : null
                                    })
                                }
                                placeholder="Ilimitado"
                                min={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxUsesPerUser">Usos máximos por usuario</Label>
                            <Input
                                id="maxUsesPerUser"
                                type="number"
                                value={formData.maxUsesPerUser || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUsesPerUser: e.target.value
                                            ? Number(e.target.value)
                                            : null
                                    })
                                }
                                placeholder="Ilimitado"
                                min={1}
                            />
                        </div>
                    </div>

                    {/* Validity dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="validFrom">Válido desde *</Label>
                            <Input
                                id="validFrom"
                                type="date"
                                value={
                                    formData.validFrom instanceof Date
                                        ? formData.validFrom.toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        validFrom: new Date(e.target.value)
                                    })
                                }
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validUntil">Válido hasta</Label>
                            <Input
                                id="validUntil"
                                type="date"
                                value={
                                    formData.validUntil instanceof Date
                                        ? formData.validUntil.toISOString().split('T')[0]
                                        : ''
                                }
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        validUntil: e.target.value ? new Date(e.target.value) : null
                                    })
                                }
                                placeholder="Sin fecha límite"
                            />
                        </div>
                    </div>

                    {/* Minimum amount */}
                    <div className="space-y-2">
                        <Label htmlFor="minimumAmount">Monto mínimo (ARS, en centavos)</Label>
                        <Input
                            id="minimumAmount"
                            type="number"
                            value={formData.minimumAmount || ''}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    minimumAmount: e.target.value ? Number(e.target.value) : null
                                })
                            }
                            placeholder="Sin mínimo"
                            min={0}
                        />
                    </div>

                    {/* Applicable plans */}
                    <div className="space-y-2">
                        <Label>Planes aplicables *</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('owner')}
                                    onChange={() => handlePlanToggle('owner')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">Propietario</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('complex')}
                                    onChange={() => handlePlanToggle('complex')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">Complejo</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.applicablePlans.includes('tourist')}
                                    onChange={() => handlePlanToggle('tourist')}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">Turista</span>
                            </label>
                        </div>
                    </div>

                    {/* Switches */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="isActive">Activo</Label>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isActive: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="isStackable">Acumulable con otros códigos</Label>
                            <Switch
                                id="isStackable"
                                checked={formData.isStackable}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isStackable: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="requiresFirstPurchase">Solo para primera compra</Label>
                            <Switch
                                id="requiresFirstPurchase"
                                checked={formData.requiresFirstPurchase}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, requiresFirstPurchase: checked })
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit">{isEdit ? 'Guardar cambios' : 'Crear código'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Delete Confirmation Dialog
 */
function DeleteConfirmDialog({
    promoCode,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => void;
}) {
    if (!promoCode) return null;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Eliminar código promocional</DialogTitle>
                    <DialogDescription>
                        ¿Estás seguro de que deseas eliminar el código{' '}
                        <code className="font-bold font-mono">{promoCode.code}</code>?
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                    <p className="text-destructive text-sm">
                        ⚠️ Esta acción no se puede deshacer. Los usuarios que ya hayan usado este
                        código no se verán afectados, pero no se podrán realizar nuevos usos.
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        Eliminar código
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Main Page Component
 */
function BillingPromoCodesPage() {
    const { addToast } = useToast();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<PromoCodeStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<DiscountType | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedPromoCode, setSelectedPromoCode] = useState<PromoCode | null>(null);

    // Fetch promo codes
    const { data, isLoading, error } = usePromoCodesQuery({
        page,
        limit: pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: searchQuery || undefined
    });

    const createMutation = useCreatePromoCodeMutation();
    const updateMutation = useUpdatePromoCodeMutation();
    const toggleActiveMutation = useTogglePromoCodeActiveMutation();
    const deleteMutation = useDeletePromoCodeMutation();

    const promoCodes = data?.items || [];
    const total = data?.pagination?.total || 0;

    const handleCreateNew = () => {
        setSelectedPromoCode(null);
        setFormDialogOpen(true);
    };

    const handleEdit = (promoCode: PromoCode) => {
        setSelectedPromoCode(promoCode);
        setFormDialogOpen(true);
    };

    const handleFormSubmit = (formData: CreatePromoCodePayload) => {
        if (selectedPromoCode) {
            // Update
            updateMutation.mutate(
                { id: selectedPromoCode.id, ...formData },
                {
                    onSuccess: () => {
                        addToast({
                            message: 'Código promocional actualizado correctamente',
                            variant: 'success'
                        });
                        setFormDialogOpen(false);
                        setSelectedPromoCode(null);
                    },
                    onError: (error) => {
                        addToast({
                            message: error.message || 'Error al actualizar código',
                            variant: 'error'
                        });
                    }
                }
            );
        } else {
            // Create
            createMutation.mutate(formData, {
                onSuccess: () => {
                    addToast({
                        message: 'Código promocional creado correctamente',
                        variant: 'success'
                    });
                    setFormDialogOpen(false);
                },
                onError: (error) => {
                    addToast({
                        message: error.message || 'Error al crear código',
                        variant: 'error'
                    });
                }
            });
        }
    };

    const handleToggleActive = (id: string, isActive: boolean) => {
        if (!data?.items) {
            addToast({
                message: 'Esta función requiere la API de facturación activa',
                variant: 'error'
            });
            return;
        }

        toggleActiveMutation.mutate(
            { id, isActive },
            {
                onSuccess: () => {
                    addToast({
                        message: `Código ${isActive ? 'activado' : 'desactivado'} correctamente`,
                        variant: 'success'
                    });
                },
                onError: (error) => {
                    addToast({
                        message: error.message || 'Error al cambiar estado',
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleDeleteClick = (promoCode: PromoCode) => {
        setSelectedPromoCode(promoCode);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!selectedPromoCode) return;

        deleteMutation.mutate(selectedPromoCode.id, {
            onSuccess: () => {
                addToast({
                    message: 'Código promocional eliminado correctamente',
                    variant: 'success'
                });
                setDeleteDialogOpen(false);
                setSelectedPromoCode(null);
            },
            onError: (error) => {
                addToast({
                    message: error.message || 'Error al eliminar código',
                    variant: 'error'
                });
            }
        });
    };

    const columns = getPromoCodeColumns({
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
        onDelete: handleDeleteClick,
        isTogglingActive: toggleActiveMutation.isPending,
        isDeleting: deleteMutation.isPending
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">Códigos Promocionales</h2>
                        <p className="text-muted-foreground">
                            Gestiona códigos de descuento y promociones para suscripciones
                        </p>
                    </div>

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="text-muted-foreground">
                                    No se pudieron cargar los códigos desde la API.
                                </p>
                                <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Mostrando datos de ejemplo como fallback.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">Códigos Promocionales</h2>
                        <p className="text-muted-foreground">
                            Gestiona códigos de descuento y promociones para suscripciones
                        </p>
                    </div>
                </div>

                {/* API Warning */}
                {!data?.items && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Nota:</strong> La API de facturación no está disponible.
                                Mostrando datos de ejemplo. Las funciones de creación, edición y
                                eliminación están disponibles pero los cambios no se persistirán.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Filters and Actions */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4">
                        <Input
                            type="search"
                            placeholder="Buscar por código..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm"
                        />

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value as PromoCodeStatus | 'all')
                            }
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="expired">Expirados</option>
                            <option value="inactive">Inactivos</option>
                        </select>

                        <select
                            className="rounded-md border px-3 py-2 text-sm"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as DiscountType | 'all')}
                        >
                            <option value="all">Todos los tipos</option>
                            <option value="percentage">Porcentaje</option>
                            <option value="fixed">Monto Fijo</option>
                        </select>
                    </div>

                    <Button onClick={handleCreateNew}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear código
                    </Button>
                </div>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Códigos Promocionales ({total})
                            {searchQuery && (
                                <Badge
                                    variant="secondary"
                                    className="ml-2"
                                >
                                    Filtrados: {promoCodes.length}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Gestiona descuentos y promociones para planes de suscripción
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={promoCodes}
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
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs */}
            <PromoCodeFormDialog
                promoCode={selectedPromoCode}
                isOpen={formDialogOpen}
                onClose={() => {
                    setFormDialogOpen(false);
                    setSelectedPromoCode(null);
                }}
                onSubmit={handleFormSubmit}
            />

            <DeleteConfirmDialog
                promoCode={selectedPromoCode}
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setSelectedPromoCode(null);
                }}
                onConfirm={handleDeleteConfirm}
            />
        </SidebarPageLayout>
    );
}
