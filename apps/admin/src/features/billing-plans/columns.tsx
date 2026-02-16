import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteIcon, EditIcon, PowerIcon } from '@repo/icons';
import type { PlanDefinition } from './types';

/**
 * Format ARS price from cents to readable string
 */
function formatArsPrice(cents: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(cents / 100);
}

interface PlanColumnsOptions {
    onEdit?: (plan: PlanDefinition) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    onDelete?: (id: string) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
}

/**
 * Get DataTable columns for plans list
 */
export function getPlanColumns(
    options: PlanColumnsOptions = {}
): ReadonlyArray<DataTableColumn<PlanDefinition>> {
    const { onEdit, onToggleActive, onDelete, isTogglingActive, isDeleting } = options;

    return [
        {
            id: 'name',
            header: 'Nombre',
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs">{row.description}</div>
                </div>
            )
        },
        {
            id: 'category',
            header: 'Categoría',
            accessorKey: 'category',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'owner', label: 'Propietario', color: BadgeColor.BLUE },
                { value: 'complex', label: 'Complejo', color: BadgeColor.PURPLE },
                { value: 'tourist', label: 'Turista', color: BadgeColor.GREEN }
            ]
        },
        {
            id: 'monthlyPrice',
            header: 'Precio Mensual',
            enableSorting: true,
            cell: ({ row }) => (
                <div>
                    <span className="font-medium">{formatArsPrice(row.monthlyPriceArs)}</span>
                    <span className="text-muted-foreground text-xs"> /mes</span>
                </div>
            )
        },
        {
            id: 'annualPrice',
            header: 'Precio Anual',
            enableSorting: true,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.annualPriceArs ? formatArsPrice(row.annualPriceArs) : '-'}
                </span>
            )
        },
        {
            id: 'entitlements',
            header: 'Permisos',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                    {row.entitlements.length} permisos
                </span>
            )
        },
        {
            id: 'limits',
            header: 'Límites',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">{row.limits.length} límites</span>
            )
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'isActive',
            enableSorting: true,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Badge variant={row.isActive ? 'success' : 'secondary'}>
                        {row.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {row.isDefault && (
                        <Badge
                            variant="outline"
                            className="border-blue-300 bg-blue-50 text-blue-700"
                        >
                            Por defecto
                        </Badge>
                    )}
                </div>
            )
        },
        {
            id: 'actions',
            header: 'Acciones',
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {onToggleActive && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleActive(row.slug, !row.isActive)}
                            disabled={isTogglingActive}
                            title={row.isActive ? 'Desactivar' : 'Activar'}
                        >
                            <PowerIcon className="mr-1 h-3 w-3" />
                            {row.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                    )}
                    {onEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(row)}
                            title="Editar"
                        >
                            <EditIcon className="mr-1 h-3 w-3" />
                            Editar
                        </Button>
                    )}
                    {onDelete && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(row.slug)}
                            disabled={isDeleting}
                            title="Eliminar"
                        >
                            <DeleteIcon className="mr-1 h-3 w-3" />
                            Eliminar
                        </Button>
                    )}
                </div>
            )
        }
    ];
}
