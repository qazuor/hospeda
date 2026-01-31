/**
 * Approaching Limits Table
 *
 * Displays customers who are approaching their limits (>90% usage)
 */
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';
import type { ApproachingLimitsResponse } from '../types';

interface ApproachingLimitsTableProps {
    data: ApproachingLimitsResponse;
}

export function ApproachingLimitsTable({ data }: ApproachingLimitsTableProps) {
    if (data.customers.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <AlertTriangle className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-muted-foreground">
                        No hay clientes cerca de alcanzar sus límites
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Todos los clientes están usando menos del {data.threshold}% de sus límites
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Clientes Cerca del Límite
                </CardTitle>
                <CardDescription>
                    {data.totalCustomers} cliente{data.totalCustomers !== 1 ? 's' : ''} usando más
                    del {data.threshold}% de algún límite
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {data.customers.map((customer, idx) => (
                        <div
                            key={`${customer.customerId}-${customer.limitKey}-${idx}`}
                            className="rounded-lg border bg-card p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{customer.customerEmail}</p>
                                        {customer.planName && (
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {customer.planName}
                                            </Badge>
                                        )}
                                    </div>
                                    {customer.customerName && (
                                        <p className="mt-1 text-muted-foreground text-sm">
                                            {customer.customerName}
                                        </p>
                                    )}
                                </div>
                                <Badge
                                    variant={
                                        customer.percentage >= 95 ? 'destructive' : 'secondary'
                                    }
                                    className="ml-2"
                                >
                                    {customer.percentage.toFixed(0)}%
                                </Badge>
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {customer.limitName}
                                    </span>
                                    <span className="font-mono text-xs">
                                        {customer.currentValue} / {customer.maxValue}
                                    </span>
                                </div>
                                <Progress
                                    value={customer.percentage}
                                    className={
                                        customer.percentage >= 95
                                            ? '[&>div]:bg-destructive'
                                            : '[&>div]:bg-orange-500'
                                    }
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
