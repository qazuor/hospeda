/**
 * System-wide Usage Statistics Cards
 *
 * Displays overview cards with system-wide metrics
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import type { SystemUsageStats } from '../types';

interface SystemStatsCardsProps {
    stats: SystemUsageStats;
    approachingLimitsCount: number;
}

export function SystemStatsCards({ stats, approachingLimitsCount }: SystemStatsCardsProps) {
    const categoryLabels: Record<string, string> = {
        owner: 'Propietarios',
        complex: 'Complejos',
        tourist: 'Turistas'
    };

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Total Customers */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="font-medium text-sm">Total de Clientes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="font-bold text-2xl">{stats.totalCustomers}</div>
                    <div className="mt-2 space-y-1">
                        {Object.entries(stats.customersByCategory).map(([category, count]) => (
                            <div
                                key={category}
                                className="flex items-center justify-between text-xs"
                            >
                                <span className="text-muted-foreground">
                                    {categoryLabels[category] || category}:
                                </span>
                                <span className="font-medium">{count}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Active Plans */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="font-medium text-sm">Planes Activos</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="font-bold text-2xl">{stats.planStats.length}</div>
                    <div className="mt-2 space-y-1">
                        {stats.planStats.slice(0, 3).map((plan) => (
                            <div
                                key={plan.planSlug}
                                className="flex items-center justify-between text-xs"
                            >
                                <span className="truncate text-muted-foreground">
                                    {plan.planName}:
                                </span>
                                <span className="ml-2 font-medium">{plan.customerCount}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Approaching Limits */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="font-medium text-sm">Cerca del Límite</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                    <div className="font-bold text-2xl text-orange-600">
                        {approachingLimitsCount}
                    </div>
                    <p className="mt-2 text-muted-foreground text-xs">
                        Clientes con uso {'>'} 90% en algún límite
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
