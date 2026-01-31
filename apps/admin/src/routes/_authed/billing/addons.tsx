/**
 * Billing Purchased Add-ons Management Page
 *
 * Shows all purchased add-ons (customerAddons) with filtering and search capabilities.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    type PurchasedAddon,
    PurchasedAddonDetailsDialog,
    type PurchasedAddonFilters,
    getPurchasedAddonColumns,
    useForceActivatePurchasedAddonMutation,
    useForceExpirePurchasedAddonMutation,
    usePurchasedAddonsQuery
} from '@/features/billing-addons';
import { useToast } from '@/hooks/use-toast';
import { createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/addons')({
    component: BillingAddonsPage
});

type StatusFilter = 'all' | 'active' | 'expired' | 'cancelled';

function BillingAddonsPage() {
    const { addToast } = useToast();

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [addonTypeFilter, setAddonTypeFilter] = useState('');
    const [customerEmailFilter, setCustomerEmailFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Details dialog state
    const [selectedAddon, setSelectedAddon] = useState<PurchasedAddon | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    // Confirmation dialog state
    const [confirmAction, setConfirmAction] = useState<{
        type: 'expire' | 'activate';
        addon: PurchasedAddon;
    } | null>(null);

    // Build filters
    const filters: PurchasedAddonFilters = {
        page,
        limit: pageSize,
        status: statusFilter,
        addonSlug: addonTypeFilter || undefined,
        customerEmail: customerEmailFilter || undefined
    };

    // Fetch purchased add-ons
    const { data, isLoading, error } = usePurchasedAddonsQuery(filters);

    // Mutations
    const forceExpireMutation = useForceExpirePurchasedAddonMutation();
    const forceActivateMutation = useForceActivatePurchasedAddonMutation();

    const purchasedAddons = data?.items || [];
    const total = data?.pagination?.total || 0;

    const handleSearch = () => {
        setCustomerEmailFilter(searchTerm);
        setPage(1); // Reset to first page when searching
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setCustomerEmailFilter('');
        setPage(1);
    };

    const handleViewDetails = (addon: PurchasedAddon) => {
        setSelectedAddon(addon);
        setShowDetailsDialog(true);
    };

    const handleForceExpire = (addon: PurchasedAddon) => {
        setConfirmAction({ type: 'expire', addon });
    };

    const handleForceActivate = (addon: PurchasedAddon) => {
        setConfirmAction({ type: 'activate', addon });
    };

    const handleConfirmAction = async () => {
        if (!confirmAction) return;

        try {
            if (confirmAction.type === 'expire') {
                await forceExpireMutation.mutateAsync(confirmAction.addon.id);
                addToast({
                    title: 'Add-on expirado',
                    message: 'El add-on fue forzado a expirar correctamente',
                    variant: 'success'
                });
            } else {
                await forceActivateMutation.mutateAsync(confirmAction.addon.id);
                addToast({
                    title: 'Add-on activado',
                    message: 'El add-on fue forzado a activar correctamente',
                    variant: 'success'
                });
            }
        } catch (err) {
            addToast({
                title: 'Error',
                message: err instanceof Error ? err.message : 'Error al procesar la acción',
                variant: 'error'
            });
        } finally {
            setConfirmAction(null);
        }
    };

    const columns = getPurchasedAddonColumns({
        onViewDetails: handleViewDetails,
        onForceExpire: handleForceExpire,
        onForceActivate: handleForceActivate
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">Add-ons Comprados</h2>
                        <p className="text-muted-foreground">
                            Visualiza todos los add-ons adquiridos por los clientes
                        </p>
                    </div>

                    <Card className="border-destructive">
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="text-destructive">
                                    No se pudieron cargar los add-ons comprados
                                </p>
                                <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Verifica que la API de facturación esté disponible.
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
                        <h2 className="mb-2 font-bold text-2xl">Add-ons Comprados</h2>
                        <p className="text-muted-foreground">
                            Visualiza todos los add-ons adquiridos por los clientes
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4">
                            {/* Search by email */}
                            <div className="flex flex-1 gap-2">
                                <div className="relative flex-1">
                                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por email del cliente..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch();
                                            }
                                        }}
                                        className="pl-9"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                                >
                                    Buscar
                                </button>
                                {customerEmailFilter && (
                                    <button
                                        type="button"
                                        onClick={handleClearSearch}
                                        className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>

                            {/* Filters row */}
                            <div className="flex gap-4">
                                {/* Status filter */}
                                <Select
                                    value={statusFilter}
                                    onValueChange={(value) => {
                                        setStatusFilter(value as StatusFilter);
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los estados</SelectItem>
                                        <SelectItem value="active">Activos</SelectItem>
                                        <SelectItem value="expired">Expirados</SelectItem>
                                        <SelectItem value="cancelled">Cancelados</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Add-on type filter */}
                                <Input
                                    placeholder="Filtrar por tipo de add-on..."
                                    value={addonTypeFilter}
                                    onChange={(e) => {
                                        setAddonTypeFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-[240px]"
                                />
                            </div>
                        </div>

                        {customerEmailFilter && (
                            <div className="mt-4">
                                <p className="text-muted-foreground text-sm">
                                    Mostrando resultados para:{' '}
                                    <span className="font-medium">{customerEmailFilter}</span>
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={purchasedAddons}
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

                {!isLoading && purchasedAddons.length === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="py-12">
                            <div className="text-center">
                                <p className="text-muted-foreground">
                                    {customerEmailFilter
                                        ? 'No se encontraron add-ons comprados para este cliente'
                                        : 'No hay add-ons comprados aún'}
                                </p>
                                <p className="mt-2 text-muted-foreground text-sm">
                                    Los add-ons comprados por los clientes aparecerán aquí
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Details Dialog */}
            <PurchasedAddonDetailsDialog
                addon={selectedAddon}
                open={showDetailsDialog}
                onOpenChange={setShowDetailsDialog}
            />

            {/* Confirmation Dialog */}
            <AlertDialog
                open={!!confirmAction}
                onOpenChange={(open: boolean) => !open && setConfirmAction(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmAction?.type === 'expire'
                                ? '¿Forzar expiración del add-on?'
                                : '¿Forzar activación del add-on?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction?.type === 'expire' ? (
                                <>
                                    Vas a forzar la expiración del add-on{' '}
                                    <strong>{confirmAction.addon.addonName}</strong> para el cliente{' '}
                                    <strong>{confirmAction.addon.customerEmail}</strong>. Esta
                                    acción cambiará el estado a &quot;expirado&quot; de forma
                                    inmediata.
                                </>
                            ) : (
                                <>
                                    Vas a forzar la activación del add-on{' '}
                                    <strong>{confirmAction?.addon.addonName}</strong> para el
                                    cliente <strong>{confirmAction?.addon.customerEmail}</strong>.
                                    Esta acción cambiará el estado a &quot;activo&quot; de forma
                                    inmediata.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={
                                confirmAction?.type === 'expire'
                                    ? 'bg-orange-600 hover:bg-orange-700'
                                    : 'bg-green-600 hover:bg-green-700'
                            }
                        >
                            {confirmAction?.type === 'expire'
                                ? 'Forzar expiración'
                                : 'Forzar activación'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SidebarPageLayout>
    );
}
