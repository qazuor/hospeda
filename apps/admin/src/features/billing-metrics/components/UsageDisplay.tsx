import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '@repo/icons';
import type { CustomerUsageSummary } from '../types';

interface UsageDisplayProps {
    usage: CustomerUsageSummary;
}

/**
 * Get color based on usage percentage
 */
function getUsageColor(percentage: number): string {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
}

/**
 * Get progress bar color based on usage percentage
 */
function getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-orange-600';
    if (percentage >= 50) return 'bg-yellow-600';
    return 'bg-green-600';
}

/**
 * Get icon based on usage percentage
 */
function getUsageIcon(percentage: number) {
    if (percentage >= 90) return <AlertCircleIcon className="h-4 w-4 text-red-600" />;
    if (percentage >= 75) return <InfoIcon className="h-4 w-4 text-orange-600" />;
    return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
}

export function UsageDisplay({ usage }: UsageDisplayProps) {
    const { customer, limits, totalLimits, limitsAtCapacity } = usage;

    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="font-medium text-muted-foreground">Email</dt>
                            <dd className="mt-1">{customer.email}</dd>
                        </div>
                        {customer.name && (
                            <div>
                                <dt className="font-medium text-muted-foreground">Nombre</dt>
                                <dd className="mt-1">{customer.name}</dd>
                            </div>
                        )}
                        <div>
                            <dt className="font-medium text-muted-foreground">Categoría</dt>
                            <dd className="mt-1 capitalize">{customer.category}</dd>
                        </div>
                        {customer.planName && (
                            <div>
                                <dt className="font-medium text-muted-foreground">Plan Actual</dt>
                                <dd className="mt-1">{customer.planName}</dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            {/* Usage Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Resumen de Uso</CardTitle>
                    <CardDescription>
                        {totalLimits} límites totales
                        {limitsAtCapacity > 0 && (
                            <span className="ml-2 text-red-600">
                                • {limitsAtCapacity} al límite
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {limits.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-muted-foreground text-sm">
                                No hay límites configurados para este cliente
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {limits.map((limit) => (
                                <div
                                    key={limit.limitKey}
                                    className="space-y-2"
                                >
                                    {/* Limit header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                {getUsageIcon(limit.percentage)}
                                                <h4 className="font-medium text-sm">
                                                    {limit.limitName}
                                                </h4>
                                            </div>
                                            {limit.limitDescription && (
                                                <p className="mt-1 text-muted-foreground text-xs">
                                                    {limit.limitDescription}
                                                </p>
                                            )}
                                        </div>
                                        <div className="ml-4 text-right">
                                            <p
                                                className={`font-semibold text-sm ${getUsageColor(limit.percentage)}`}
                                            >
                                                {limit.percentage.toFixed(1)}%
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {limit.currentValue} / {limit.maxValue} {limit.unit}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full transition-all ${getProgressColor(limit.percentage)}`}
                                            style={{ width: `${Math.min(limit.percentage, 100)}%` }}
                                        />
                                    </div>

                                    {/* Warning message for high usage */}
                                    {limit.percentage >= 90 && (
                                        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-800 text-xs">
                                            <AlertCircleIcon className="h-3 w-3" />
                                            <span>
                                                Este límite está cerca o ha alcanzado su capacidad
                                                máxima
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
