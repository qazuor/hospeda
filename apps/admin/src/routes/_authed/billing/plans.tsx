/**
 * Billing Plans Management Page
 *
 * Manages subscription plans for owners, complexes, and tourists.
 * Supports viewing plan details, entitlements, limits, and pricing.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DataTable } from '@/components/table/DataTable';
import type { DataTableColumn } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    type PlanDefinition,
    getPlanColumns,
    useDeletePlanMutation,
    usePlansQuery,
    useTogglePlanActiveMutation
} from '@/features/billing-plans';
import { ALL_PLANS } from '@repo/billing';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/plans')({
    component: BillingPlansPage
});

type PlanCategory = 'all' | 'owner' | 'complex' | 'tourist';

function BillingPlansPage() {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [categoryFilter, setCategoryFilter] = useState<PlanCategory>('all');

    // Fetch plans from API
    // NOTE: Currently using static data from @repo/billing as fallback
    // until qzpay-hono billing API routes are implemented
    const { data, isLoading, error } = usePlansQuery({
        page,
        limit: pageSize,
        category: categoryFilter
    });

    const toggleActiveMutation = useTogglePlanActiveMutation();
    const deleteMutation = useDeletePlanMutation();

    // Use API data if available, otherwise fall back to static config
    const plans = data?.items || ALL_PLANS;
    const total = data?.pagination?.total || ALL_PLANS.length;

    // Apply client-side filtering if using static data
    const filteredPlans = data?.items
        ? plans
        : (ALL_PLANS as readonly PlanDefinition[]).filter((plan: PlanDefinition) => {
              if (categoryFilter === 'all') return true;
              return plan.category === categoryFilter;
          });

    const handleCreateNew = () => {
        // TODO: Implement create dialog
        alert('Funcionalidad de creación en desarrollo. Requiere API de facturación.');
    };

    const handleEdit = (_plan: PlanDefinition) => {
        // TODO: Implement edit dialog
        alert('Funcionalidad de edición en desarrollo. Requiere API de facturación.');
    };

    const handleToggleActive = (id: string, isActive: boolean) => {
        if (!data?.items) {
            alert('Esta función requiere la API de facturación activa.');
            return;
        }

        if (confirm(`¿Estás seguro de ${isActive ? 'activar' : 'desactivar'} este plan?`)) {
            toggleActiveMutation.mutate({ id, isActive });
        }
    };

    const handleDelete = (id: string) => {
        if (!data?.items) {
            alert('Esta función requiere la API de facturación activa.');
            return;
        }

        if (
            confirm(
                '¿Estás seguro de eliminar este plan? Esta acción no se puede deshacer y afectará a los usuarios con este plan.'
            )
        ) {
            deleteMutation.mutate(id);
        }
    };

    const columns = getPlanColumns({
        onEdit: handleEdit,
        onToggleActive: handleToggleActive,
        onDelete: handleDelete,
        isTogglingActive: toggleActiveMutation.isPending,
        isDeleting: deleteMutation.isPending
    });

    if (error) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">Planes de Suscripción</h2>
                        <p className="text-muted-foreground">
                            Gestiona los planes de suscripción disponibles para los usuarios
                        </p>
                    </div>

                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <p className="text-muted-foreground">
                                    No se pudieron cargar los planes desde la API.
                                </p>
                                <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Mostrando datos estáticos de configuración como fallback.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <PlansTable
                        plans={filteredPlans}
                        total={filteredPlans.length}
                        page={page}
                        pageSize={pageSize}
                        columns={columns}
                        isLoading={false}
                        categoryFilter={categoryFilter}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        onCategoryFilterChange={setCategoryFilter}
                        onCreateNew={handleCreateNew}
                    />
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="mb-2 font-bold text-2xl">Planes de Suscripción</h2>
                        <p className="text-muted-foreground">
                            Gestiona los planes de suscripción disponibles para los usuarios
                        </p>
                    </div>
                </div>

                {!data?.items && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Nota:</strong> La API de facturación no está disponible.
                                Mostrando datos estáticos de configuración. Las funciones de
                                creación, edición y eliminación están deshabilitadas.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <PlansTable
                    plans={filteredPlans}
                    total={data?.items ? total : filteredPlans.length}
                    page={page}
                    pageSize={pageSize}
                    columns={columns}
                    isLoading={isLoading}
                    categoryFilter={categoryFilter}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onCategoryFilterChange={setCategoryFilter}
                    onCreateNew={handleCreateNew}
                />
            </div>
        </SidebarPageLayout>
    );
}

interface PlansTableProps {
    plans: readonly PlanDefinition[];
    total: number;
    page: number;
    pageSize: number;
    columns: ReadonlyArray<DataTableColumn<PlanDefinition>>;
    isLoading: boolean;
    categoryFilter: PlanCategory;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    onCategoryFilterChange: (filter: PlanCategory) => void;
    onCreateNew: () => void;
}

function PlansTable({
    plans,
    total,
    page,
    pageSize,
    columns,
    isLoading,
    categoryFilter,
    onPageChange,
    onPageSizeChange,
    onCategoryFilterChange,
    onCreateNew
}: PlansTableProps) {
    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                    <select
                        className="rounded-md border px-3 py-2 text-sm"
                        value={categoryFilter}
                        onChange={(e) => onCategoryFilterChange(e.target.value as PlanCategory)}
                    >
                        <option value="all">Todas las categorías</option>
                        <option value="owner">Propietario</option>
                        <option value="complex">Complejo</option>
                        <option value="tourist">Turista</option>
                    </select>
                </div>

                <Button onClick={onCreateNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear plan
                </Button>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={plans}
                total={total}
                rowId={(row) => row.slug}
                loading={isLoading}
                page={page}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                sort={[]}
                onSortChange={() => {}}
                columnVisibility={{}}
                onColumnVisibilityChange={() => {}}
            />
        </div>
    );
}
