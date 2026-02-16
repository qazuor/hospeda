import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteIcon, EditIcon, PowerIcon } from '@repo/icons';
import type { AddonDefinition } from './types';

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

/**
 * Get target categories label
 */
function getCategoriesLabel(categories: readonly string[]): string {
    const labels: Record<string, string> = {
        owner: 'Propietario',
        complex: 'Complejo',
        tourist: 'Turista'
    };
    return categories.map((c) => labels[c] || c).join(', ');
}

interface AddonColumnsOptions {
    onEdit?: (addon: AddonDefinition) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    onDelete?: (id: string) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
}

/**
 * Get DataTable columns for add-ons list
 */
export function getAddonColumns(
    options: AddonColumnsOptions = {}
): ReadonlyArray<DataTableColumn<AddonDefinition>> {
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
            id: 'billingType',
            header: 'Tipo',
            accessorKey: 'billingType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'one_time', label: 'Único', color: BadgeColor.BLUE },
                { value: 'recurring', label: 'Recurrente', color: BadgeColor.PURPLE }
            ]
        },
        {
            id: 'price',
            header: 'Precio',
            enableSorting: true,
            cell: ({ row }) => (
                <div>
                    <span className="font-medium">{formatArsPrice(row.priceArs)}</span>
                    {row.billingType === 'recurring' && (
                        <span className="text-muted-foreground text-xs"> /mes</span>
                    )}
                </div>
            )
        },
        {
            id: 'duration',
            header: 'Duración',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.durationDays ? `${row.durationDays} días` : '-'}
                </span>
            )
        },
        {
            id: 'categories',
            header: 'Categorías',
            accessorKey: 'targetCategories',
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-xs">
                    {getCategoriesLabel(row.targetCategories)}
                </span>
            )
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
