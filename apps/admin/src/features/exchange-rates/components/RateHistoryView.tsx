import { Badge } from '@/components/ui/badge';
/**
 * Rate History View
 *
 * Component for viewing exchange rate history with filters and pagination.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useState } from 'react';
import { useExchangeRateHistoryQuery } from '../hooks';
import type { ExchangeRate, ExchangeRateHistoryFilters } from '../types';

/**
 * Format date to local string
 */
function formatDate(date: Date): string {
    return new Date(date).toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format rate value
 */
function formatRate(rate: number): string {
    return rate.toFixed(4);
}

/**
 * Get badge variant for rate type
 */
function getRateTypeBadge(rateType: string): React.ReactNode {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        oficial: 'default',
        blue: 'secondary',
        mep: 'outline',
        ccl: 'outline',
        tarjeta: 'destructive',
        standard: 'secondary'
    };

    return <Badge variant={variants[rateType] || 'default'}>{rateType.toUpperCase()}</Badge>;
}

/**
 * Get badge variant for source
 */
function getSourceBadge(source: string): React.ReactNode {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        dolarapi: 'default',
        'exchangerate-api': 'secondary',
        manual: 'outline'
    };

    return <Badge variant={variants[source] || 'default'}>{source}</Badge>;
}

export function RateHistoryView() {
    const [filters, setFilters] = useState<ExchangeRateHistoryFilters>({
        fromCurrency: undefined,
        toCurrency: undefined,
        rateType: undefined,
        source: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        limit: 50
    });

    const { data: history, isLoading, error } = useExchangeRateHistoryQuery(filters);

    const handleFilterChange = (key: keyof ExchangeRateHistoryFilters, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value === 'all' || value === '' ? undefined : value
        }));
    };

    const handleReset = () => {
        setFilters({
            fromCurrency: undefined,
            toCurrency: undefined,
            rateType: undefined,
            source: undefined,
            from: undefined,
            to: undefined,
            page: 1,
            limit: 50
        });
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">Filtros</h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <Label htmlFor="fromCurrency">Moneda Origen</Label>
                        <Select
                            value={filters.fromCurrency || 'all'}
                            onValueChange={(value) => handleFilterChange('fromCurrency', value)}
                        >
                            <SelectTrigger id="fromCurrency">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="BRL">BRL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="toCurrency">Moneda Destino</Label>
                        <Select
                            value={filters.toCurrency || 'all'}
                            onValueChange={(value) => handleFilterChange('toCurrency', value)}
                        >
                            <SelectTrigger id="toCurrency">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="BRL">BRL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="rateType">Tipo de Tasa</Label>
                        <Select
                            value={filters.rateType || 'all'}
                            onValueChange={(value) => handleFilterChange('rateType', value)}
                        >
                            <SelectTrigger id="rateType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="oficial">Oficial</SelectItem>
                                <SelectItem value="blue">Blue</SelectItem>
                                <SelectItem value="mep">MEP</SelectItem>
                                <SelectItem value="ccl">CCL</SelectItem>
                                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                <SelectItem value="standard">Standard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="source">Fuente</Label>
                        <Select
                            value={filters.source || 'all'}
                            onValueChange={(value) => handleFilterChange('source', value)}
                        >
                            <SelectTrigger id="source">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="dolarapi">DolarAPI</SelectItem>
                                <SelectItem value="exchangerate-api">ExchangeRate-API</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="from">Desde</Label>
                        <Input
                            id="from"
                            type="date"
                            value={filters.from || ''}
                            onChange={(e) => handleFilterChange('from', e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="to">Hasta</Label>
                        <Input
                            id="to"
                            type="date"
                            value={filters.to || ''}
                            onChange={(e) => handleFilterChange('to', e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                    >
                        Limpiar Filtros
                    </Button>
                </div>
            </div>

            {/* History Table */}
            <div className="rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-sm">Fecha</th>
                                <th className="px-4 py-3 text-left font-medium text-sm">Par</th>
                                <th className="px-4 py-3 text-left font-medium text-sm">Tasa</th>
                                <th className="px-4 py-3 text-left font-medium text-sm">Tipo</th>
                                <th className="px-4 py-3 text-left font-medium text-sm">Fuente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        Cargando historial...
                                    </td>
                                </tr>
                            )}

                            {error && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-destructive"
                                    >
                                        Error al cargar historial:{' '}
                                        {error instanceof Error
                                            ? error.message
                                            : 'Error desconocido'}
                                    </td>
                                </tr>
                            )}

                            {!isLoading && !error && (!history || history.length === 0) && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        No se encontraron registros
                                    </td>
                                </tr>
                            )}

                            {!isLoading &&
                                !error &&
                                history &&
                                history.length > 0 &&
                                (history as unknown as ExchangeRate[]).map((rate, index) => (
                                    <tr
                                        key={`${rate.id}-${index}`}
                                        className="border-b hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3 text-sm">
                                            {formatDate(new Date(rate.fetchedAt))}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-sm">
                                            {rate.fromCurrency}/{rate.toCurrency}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm">
                                            {formatRate(rate.rate)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {getRateTypeBadge(rate.rateType)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {getSourceBadge(rate.source)}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Info */}
                {!isLoading && !error && history && history.length > 0 && (
                    <div className="border-t px-4 py-3 text-muted-foreground text-sm">
                        Mostrando {history.length} registros
                    </div>
                )}
            </div>
        </div>
    );
}
