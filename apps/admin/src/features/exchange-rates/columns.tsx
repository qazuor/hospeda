import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteIcon } from '@repo/icons';
import type { ExchangeRate } from './types';

/**
 * Format rate value with appropriate decimal places
 */
function formatRate(rate: number, decimals = 4): string {
    return rate.toFixed(decimals);
}

/**
 * Format time relative to now (e.g., "hace 5 min")
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffHr < 24) return `hace ${diffHr}h`;
    if (diffDay === 1) return 'hace 1 día';
    if (diffDay < 30) return `hace ${diffDay} días`;

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Check if a date is stale (older than 1 hour)
 */
function isStaleDate(date: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHr = diffMs / (1000 * 60 * 60);
    return diffHr > 1;
}

/**
 * Get badge color for rate type
 */
function getRateTypeBadgeColor(rateType: string): BadgeColor {
    const colors: Record<string, BadgeColor> = {
        oficial: BadgeColor.BLUE,
        blue: BadgeColor.GREEN,
        mep: BadgeColor.PURPLE,
        ccl: BadgeColor.YELLOW,
        tarjeta: BadgeColor.RED,
        standard: BadgeColor.DEFAULT
    };
    return colors[rateType] || BadgeColor.DEFAULT;
}

/**
 * Get label for rate type
 */
function getRateTypeLabel(rateType: string): string {
    const labels: Record<string, string> = {
        oficial: 'Oficial',
        blue: 'Blue',
        mep: 'MEP',
        ccl: 'CCL',
        tarjeta: 'Tarjeta',
        standard: 'Standard'
    };
    return labels[rateType] || rateType;
}

/**
 * Get badge color for source
 */
function getSourceBadgeColor(source: string): BadgeColor {
    const colors: Record<string, BadgeColor> = {
        dolarapi: BadgeColor.BLUE,
        'exchangerate-api': BadgeColor.GREEN,
        manual: BadgeColor.YELLOW
    };
    return colors[source] || BadgeColor.DEFAULT;
}

/**
 * Get label for source
 */
function getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
        dolarapi: 'DolarAPI',
        'exchangerate-api': 'ExchangeRate-API',
        manual: 'Manual'
    };
    return labels[source] || source;
}

interface ExchangeRateColumnsOptions {
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
}

/**
 * Get DataTable columns for exchange rates list
 */
export function getExchangeRateColumns(
    options: ExchangeRateColumnsOptions = {}
): ReadonlyArray<DataTableColumn<ExchangeRate>> {
    const { onDelete, isDeleting } = options;

    return [
        {
            id: 'currencyPair',
            header: 'Par',
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div className="font-medium">
                    {row.fromCurrency}/{row.toCurrency}
                </div>
            )
        },
        {
            id: 'rate',
            header: 'Tasa',
            enableSorting: true,
            columnType: ColumnType.NUMBER,
            cell: ({ row }) => <div className="font-mono text-sm">{formatRate(row.rate, 4)}</div>
        },
        {
            id: 'inverseRate',
            header: 'Tasa Inversa',
            enableSorting: true,
            columnType: ColumnType.NUMBER,
            cell: ({ row }) => (
                <div className="font-mono text-muted-foreground text-xs">
                    {formatRate(row.inverseRate, 6)}
                </div>
            )
        },
        {
            id: 'rateType',
            header: 'Tipo de Tasa',
            accessorKey: 'rateType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'oficial', label: 'Oficial', color: BadgeColor.BLUE },
                { value: 'blue', label: 'Blue', color: BadgeColor.GREEN },
                { value: 'mep', label: 'MEP', color: BadgeColor.PURPLE },
                { value: 'ccl', label: 'CCL', color: BadgeColor.YELLOW },
                { value: 'tarjeta', label: 'Tarjeta', color: BadgeColor.RED },
                { value: 'standard', label: 'Standard', color: BadgeColor.DEFAULT }
            ],
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={`badge-${getRateTypeBadgeColor(row.rateType)}`}
                >
                    {getRateTypeLabel(row.rateType)}
                </Badge>
            )
        },
        {
            id: 'source',
            header: 'Fuente',
            accessorKey: 'source',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: 'dolarapi', label: 'DolarAPI', color: BadgeColor.BLUE },
                { value: 'exchangerate-api', label: 'ExchangeRate-API', color: BadgeColor.GREEN },
                { value: 'manual', label: 'Manual', color: BadgeColor.YELLOW }
            ],
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={`badge-${getSourceBadgeColor(row.source)}`}
                >
                    {getSourceLabel(row.source)}
                </Badge>
            )
        },
        {
            id: 'fetchedAt',
            header: 'Última Actualización',
            accessorKey: 'fetchedAt',
            enableSorting: true,
            columnType: ColumnType.DATE,
            cell: ({ row }) => {
                const fetchedAt = new Date(row.fetchedAt);
                const isStale = isStaleDate(fetchedAt);

                return (
                    <div className="text-sm">
                        <div>{formatRelativeTime(fetchedAt)}</div>
                        {isStale && (
                            <div className="text-muted-foreground text-xs">(desactualizado)</div>
                        )}
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: 'Acciones',
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                if (!row.isManualOverride) return null;

                return (
                    <div className="flex gap-2">
                        {onDelete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDelete(row.id)}
                                disabled={isDeleting}
                                title="Eliminar"
                            >
                                <DeleteIcon className="mr-1 h-3 w-3" />
                                Eliminar
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];
}
