import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteIcon, EditIcon, PowerIcon } from '@repo/icons';
import type { PlanCategory, PromoCode } from './types';

/**
 * Format discount value based on type
 */
function formatDiscount(type: 'percentage' | 'fixed', value: number): string {
    if (type === 'percentage') {
        return `${value}%`;
    }
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value / 100);
}

/**
 * Format usage count
 */
function formatUsage(used: number, max: number | null): string {
    return max ? `${used} / ${max}` : `${used} / ∞`;
}

/**
 * Format date range
 */
function formatDateRange(from: Date, until: Date | null): string {
    const fromStr = from.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    if (!until) {
        return `Desde ${fromStr}`;
    }
    const untilStr = until.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${fromStr} - ${untilStr}`;
}

/**
 * Get plan label
 */
function getPlanLabel(plan: PlanCategory): string {
    switch (plan) {
        case 'owner':
            return 'Propietario';
        case 'complex':
            return 'Complejo';
        case 'tourist':
            return 'Turista';
    }
}

interface PromoCodeColumnsOptions {
    onEdit?: (promoCode: PromoCode) => void;
    onToggleActive?: (id: string, isActive: boolean) => void;
    onDelete?: (promoCode: PromoCode) => void;
    isTogglingActive?: boolean;
    isDeleting?: boolean;
}

/**
 * Get DataTable columns for promo codes list
 */
export function getPromoCodeColumns(
    options: PromoCodeColumnsOptions = {}
): ReadonlyArray<DataTableColumn<PromoCode>> {
    const { onEdit, onToggleActive, onDelete, isTogglingActive, isDeleting } = options;

    return [
        {
            id: 'code',
            header: 'Código',
            accessorKey: 'code',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{row.code}</code>
                    <div className="mt-1 text-muted-foreground text-xs">{row.description}</div>
                </div>
            )
        },
        {
            id: 'type',
            header: 'Tipo',
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'percentage', label: 'Porcentaje', color: BadgeColor.BLUE },
                { value: 'fixed', label: 'Monto Fijo', color: BadgeColor.PURPLE }
            ]
        },
        {
            id: 'discount',
            header: 'Descuento',
            accessorKey: 'discountValue',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="font-semibold">{formatDiscount(row.type, row.discountValue)}</span>
            )
        },
        {
            id: 'usage',
            header: 'Usos',
            accessorKey: 'usedCount',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatUsage(row.usedCount, row.maxUses)}
                </span>
            )
        },
        {
            id: 'validity',
            header: 'Vigencia',
            accessorKey: 'validFrom',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-sm">{formatDateRange(row.validFrom, row.validUntil)}</span>
            )
        },
        {
            id: 'plans',
            header: 'Planes',
            accessorKey: 'applicablePlans',
            enableSorting: false,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.applicablePlans.length === 3 ? (
                        <Badge variant="secondary">Todos</Badge>
                    ) : (
                        row.applicablePlans.map((plan) => (
                            <Badge
                                key={plan}
                                variant="outline"
                            >
                                {getPlanLabel(plan)}
                            </Badge>
                        ))
                    )}
                </div>
            )
        },
        {
            id: 'features',
            header: 'Características',
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.isStackable && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            Acumulable
                        </Badge>
                    )}
                    {row.requiresFirstPurchase && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            Primera compra
                        </Badge>
                    )}
                    {row.minimumAmount && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                        >
                            Mínimo
                        </Badge>
                    )}
                </div>
            )
        },
        {
            id: 'status',
            header: 'Estado',
            accessorKey: 'status',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'active', label: 'Activo', color: BadgeColor.GREEN },
                { value: 'expired', label: 'Expirado', color: BadgeColor.GRAY },
                { value: 'inactive', label: 'Inactivo', color: BadgeColor.RED }
            ]
        },
        {
            id: 'actions',
            header: 'Acciones',
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <div className="flex gap-2">
                    {onToggleActive && row.status !== 'expired' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleActive(row.id, !row.isActive)}
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
                            onClick={() => onDelete(row)}
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
