import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OwnerPromotion } from './types';

/**
 * Create columns for owner promotions table
 */
export function createOwnerPromotionsColumns(
    onEdit: (promotion: OwnerPromotion) => void,
    onDelete: (promotion: OwnerPromotion) => void,
    onToggleActive: (promotion: OwnerPromotion) => void
): DataTableColumn<OwnerPromotion>[] {
    return [
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
                        onClick={() => onToggleActive(row)}
                    >
                        {row.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(row)}
                    >
                        Editar
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(row)}
                    >
                        Eliminar
                    </Button>
                </div>
            )
        }
    ];
}
