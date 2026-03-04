/**
 * System-wide Usage Statistics Cards
 *
 * Displays overview cards with system-wide metrics
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { AlertTriangleIcon, TrendingUpIcon, UsersIcon } from '@repo/icons';
import type { SystemUsageStats } from '../types';

interface SystemStatsCardsProps {
    stats: SystemUsageStats;
    approachingLimitsCount: number;
}

export function SystemStatsCards({ stats, approachingLimitsCount }: SystemStatsCardsProps) {
    const { t } = useTranslations();

    const categoryLabels: Record<string, string> = {
        owner: t('admin-billing.metrics.systemStats.categoryOwner'),
        complex: t('admin-billing.metrics.systemStats.categoryComplex'),
        tourist: t('admin-billing.metrics.systemStats.categoryTourist')
    };

    return (
        <div className="grid gap-4 md:grid-cols-3">
            {/* Total Customers */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="font-medium text-sm">
                        {t('admin-billing.metrics.systemStats.totalCustomers')}
                    </CardTitle>
                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
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
                    <CardTitle className="font-medium text-sm">
                        {t('admin-billing.metrics.systemStats.activePlans')}
                    </CardTitle>
                    <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
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
                    <CardTitle className="font-medium text-sm">
                        {t('admin-billing.metrics.systemStats.approachingLimits')}
                    </CardTitle>
                    <AlertTriangleIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </CardHeader>
                <CardContent>
                    <div className="font-bold text-2xl text-orange-600 dark:text-orange-400">
                        {approachingLimitsCount}
                    </div>
                    <p className="mt-2 text-muted-foreground text-xs">
                        {t('admin-billing.metrics.systemStats.approachingLimitsHint')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
