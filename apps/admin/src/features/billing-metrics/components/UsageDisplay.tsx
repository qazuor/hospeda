import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatNumber } from '@repo/i18n';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '@repo/icons';
import type { CustomerUsageSummary } from '../types';

interface UsageDisplayProps {
    usage: CustomerUsageSummary;
}

/**
 * Get color based on usage percentage
 */
function getUsageColor(percentage: number): string {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
}

/**
 * Get progress bar color based on usage percentage
 */
function getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-600 dark:bg-red-500';
    if (percentage >= 75) return 'bg-orange-600 dark:bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-600 dark:bg-yellow-500';
    return 'bg-green-600 dark:bg-green-500';
}

/**
 * Get icon based on usage percentage
 */
function getUsageIcon(percentage: number) {
    if (percentage >= 90)
        return <AlertCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />;
    if (percentage >= 75)
        return <InfoIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
    return <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />;
}

export function UsageDisplay({ usage }: UsageDisplayProps) {
    const { t, locale } = useTranslations();
    const { customer, limits, totalLimits, limitsAtCapacity } = usage;

    return (
        <div className="space-y-6">
            {/* Customer Info */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('admin-billing.metrics.usageDisplay.customerInfoTitle')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="font-medium text-muted-foreground">
                                {t('admin-billing.metrics.usageDisplay.emailLabel')}
                            </dt>
                            <dd className="mt-1">{customer.email}</dd>
                        </div>
                        {customer.name && (
                            <div>
                                <dt className="font-medium text-muted-foreground">
                                    {t('admin-billing.metrics.usageDisplay.nameLabel')}
                                </dt>
                                <dd className="mt-1">{customer.name}</dd>
                            </div>
                        )}
                        <div>
                            <dt className="font-medium text-muted-foreground">
                                {t('admin-billing.metrics.usageDisplay.categoryLabel')}
                            </dt>
                            <dd className="mt-1 capitalize">{customer.category}</dd>
                        </div>
                        {customer.planName && (
                            <div>
                                <dt className="font-medium text-muted-foreground">
                                    {t('admin-billing.metrics.usageDisplay.currentPlanLabel')}
                                </dt>
                                <dd className="mt-1">{customer.planName}</dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            {/* Usage Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('admin-billing.metrics.usageDisplay.usageSummaryTitle')}
                    </CardTitle>
                    <CardDescription>
                        {totalLimits} {t('admin-billing.metrics.usageDisplay.totalLimits')}
                        {limitsAtCapacity > 0 && (
                            <span className="ml-2 text-red-600 dark:text-red-400">
                                • {limitsAtCapacity}{' '}
                                {t('admin-billing.metrics.usageDisplay.atCapacity')}
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {limits.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-billing.metrics.usageDisplay.noLimitsMessage')}
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
                                                {formatNumber({
                                                    value: limit.percentage,
                                                    locale,
                                                    options: {
                                                        minimumFractionDigits: 1,
                                                        maximumFractionDigits: 1
                                                    }
                                                })}
                                                %
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
                                        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-800 text-xs dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                                            <AlertCircleIcon className="h-3 w-3" />
                                            <span>
                                                {t(
                                                    'admin-billing.metrics.usageDisplay.nearCapacityWarning'
                                                )}
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
