import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Eye, MoreHorizontal, Power, PowerOff } from 'lucide-react';
import type { PurchasedAddon } from './types';

/**
 * Row actions handler type
 */
export interface PurchasedAddonRowActions {
    onViewDetails: (addon: PurchasedAddon) => void;
    onForceExpire: (addon: PurchasedAddon) => void;
    onForceActivate: (addon: PurchasedAddon) => void;
}

/**
 * Format date to Spanish locale
 */
function formatDate(dateString: string | null): string {
    if (!dateString) return '—';

    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(dateString));
}

/**
 * Format price in ARS
 */
function formatPrice(cents: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(cents / 100);
}

/**
 * Get DataTable columns for purchased add-ons list
 */
export function getPurchasedAddonColumns(
    actions?: PurchasedAddonRowActions
): ReadonlyArray<DataTableColumn<PurchasedAddon>> {
    const columns: DataTableColumn<PurchasedAddon>[] = [
        {
            id: 'customerEmail',
            header: 'Cliente',
            accessorKey: 'customerEmail',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.customerEmail}</div>
                    {row.customerName && (
                        <div className="text-muted-foreground text-xs">{row.customerName}</div>
                    )}
                </div>
            )
        },
        {
            id: 'addon',
            header: 'Add-on',
            accessorKey: 'addonSlug',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.addonName}</div>
                    <div className="font-mono text-muted-foreground text-xs">{row.addonSlug}</div>
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
                { value: 'expired', label: 'Expirado', color: BadgeColor.SECONDARY },
                { value: 'cancelled', label: 'Cancelado', color: BadgeColor.RED }
            ]
        },
        {
            id: 'purchasedAt',
            header: 'Fecha de Compra',
            accessorKey: 'purchasedAt',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => <span className="text-sm">{formatDate(row.purchasedAt)}</span>
        },
        {
            id: 'expiresAt',
            header: 'Fecha de Expiración',
            accessorKey: 'expiresAt',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.expiresAt ? formatDate(row.expiresAt) : 'Sin expiración'}
                </span>
            )
        },
        {
            id: 'price',
            header: 'Precio',
            enableSorting: true,
            cell: ({ row }) => <span className="font-medium">{formatPrice(row.priceArs)}</span>
        },
        {
            id: 'paymentId',
            header: 'ID de Pago',
            accessorKey: 'paymentId',
            enableSorting: false,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <span className="font-mono text-muted-foreground text-xs">
                    {row.paymentId || '—'}
                </span>
            )
        }
    ];

    // Add actions column if actions are provided
    if (actions) {
        columns.push({
            id: 'actions',
            header: 'Acciones',
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                        >
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => actions.onViewDetails(row)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {row.status === 'active' && (
                            <DropdownMenuItem
                                onClick={() => actions.onForceExpire(row)}
                                className="text-orange-600 focus:text-orange-600"
                            >
                                <PowerOff className="mr-2 h-4 w-4" />
                                Forzar expiración
                            </DropdownMenuItem>
                        )}
                        {(row.status === 'expired' || row.status === 'cancelled') && (
                            <DropdownMenuItem
                                onClick={() => actions.onForceActivate(row)}
                                className="text-green-600 focus:text-green-600"
                            >
                                <Power className="mr-2 h-4 w-4" />
                                Forzar activación
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        });
    }

    return columns;
}
