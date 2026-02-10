/**
 * UsageMeters Component
 *
 * Displays usage progress bars for subscription limits using qzpay-react
 *
 * @module components/billing/UsageMeters
 */

'use client';

import { useCurrentCustomer, useLimits } from '@qazuor/qzpay-react';
import { useTranslations } from '@repo/i18n';

/**
 * Component props
 */
export interface UsageMetersProps {
    /**
     * Optional customer ID override
     * If not provided, uses current customer from context
     */
    customerId?: string;
}

/**
 * Get color classes based on usage percentage
 */
function getUsageColor(percentage: number) {
    if (percentage >= 80) {
        return {
            bg: 'bg-red-500',
            text: 'text-red-700',
            ring: 'ring-red-200'
        };
    }
    if (percentage >= 60) {
        return {
            bg: 'bg-yellow-500',
            text: 'text-yellow-700',
            ring: 'ring-yellow-200'
        };
    }
    return {
        bg: 'bg-green-500',
        text: 'text-green-700',
        ring: 'ring-green-200'
    };
}

/**
 * Format limit key to human-readable name
 */
function formatLimitName(limitKey: string): string {
    // Convert snake_case to Title Case
    return limitKey
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Format usage value
 */
function formatUsage(value: number): string {
    return value.toString();
}

/**
 * Check if a limit is unlimited (-1 typically means unlimited)
 */
function isUnlimited(maxValue: number): boolean {
    return maxValue === -1 || maxValue === 0;
}

/**
 * UsageMeters Component
 *
 * Displays resource usage with progress bars and warnings
 * Uses useLimits() hook from @qazuor/qzpay-react
 *
 * @example
 * ```tsx
 * // Within BillingIsland with QZPayProvider
 * <UsageMeters />
 * ```
 *
 * @example
 * ```tsx
 * // With specific customer ID
 * <UsageMeters customerId="cus_123" />
 * ```
 */
export function UsageMeters({ customerId: customerIdProp }: UsageMetersProps) {
    const [currentCustomer] = useCurrentCustomer();
    const customerId = customerIdProp || currentCustomer?.id;
    const { t } = useTranslations();

    const {
        data: limits,
        isLoading,
        error
    } = useLimits({
        customerId: customerId || ''
    });

    if (!customerId) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.usage.title')}
                </h2>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
                    <p className="text-yellow-700">{t('billing.usage.authRequired')}</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.usage.title')}
                </h2>
                <div
                    className="flex items-center justify-center py-12"
                    // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                    role="status"
                >
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.usage.title')}
                </h2>
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <svg
                        className="mx-auto mb-3 h-12 w-12 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p className="text-red-700">{error.message}</p>
                </div>
            </div>
        );
    }

    // Filter out unlimited limits and empty limits
    const activeLimits = (limits || []).filter(
        (limit) => !isUnlimited(limit.maxValue) && limit.maxValue > 0
    );

    if (activeLimits.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.usage.title')}
                </h2>
                <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 p-8 text-center">
                    <svg
                        className="mx-auto mb-4 h-16 w-16 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                    </svg>
                    <h3 className="mb-2 font-bold text-gray-900 text-xl">
                        {t('billing.usage.unlimited.title')}
                    </h3>
                    <p className="text-gray-600">{t('billing.usage.unlimited.description')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">{t('billing.usage.title')}</h2>

            <div className="space-y-6">
                {activeLimits.map((limit) => {
                    const percentage = Math.min((limit.currentValue / limit.maxValue) * 100, 100);
                    const colors = getUsageColor(percentage);
                    const isApproachingLimit = percentage >= 60;
                    const isAtLimit = percentage >= 80;
                    const limitName = formatLimitName(limit.limitKey);

                    return (
                        <div
                            key={limit.limitKey}
                            className="space-y-2"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{limitName}</h3>
                                </div>
                                <div className="ml-4 text-right">
                                    <span className={`font-bold text-sm ${colors.text}`}>
                                        {formatUsage(limit.currentValue)} /{' '}
                                        {formatUsage(limit.maxValue)}
                                    </span>
                                    <p className="text-gray-500 text-xs">
                                        {t('billing.usage.percentUsed', {
                                            percentage: percentage.toFixed(0)
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div
                                className="h-3 overflow-hidden rounded-full bg-gray-100"
                                aria-label={`${limitName}: ${t('billing.usage.percentUsed', { percentage: percentage.toFixed(0) })}`}
                            >
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            {/* Warning messages */}
                            {isAtLimit && (
                                <div
                                    className={`mt-3 rounded-lg border p-3 ${colors.ring} bg-red-50 ring-2`}
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="font-medium text-red-800 text-sm">
                                                {t('billing.usage.atLimit.title')}
                                            </p>
                                            <p className="mt-1 text-red-700 text-sm">
                                                {t('billing.usage.atLimit.message')}{' '}
                                                <a
                                                    href="/precios/propietarios"
                                                    className="font-semibold underline hover:no-underline"
                                                >
                                                    {t('billing.usage.atLimit.cta')}
                                                </a>{' '}
                                                {t('billing.usage.atLimit.ctaSuffix')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isApproachingLimit && !isAtLimit && (
                                <div
                                    className={`mt-3 rounded-lg border p-3 ${colors.ring} bg-yellow-50 ring-2`}
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-yellow-800">
                                                {t('billing.usage.nearLimit.title')}
                                            </p>
                                            <p className="mt-1 text-sm text-yellow-700">
                                                {t('billing.usage.nearLimit.message', {
                                                    percentage: percentage.toFixed(0)
                                                })}{' '}
                                                <a
                                                    href="/precios/propietarios"
                                                    className="font-semibold underline hover:no-underline"
                                                >
                                                    {t('billing.usage.nearLimit.cta')}
                                                </a>{' '}
                                                {t('billing.usage.nearLimit.ctaSuffix')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Overall upgrade CTA if any limit is near/at capacity */}
            {activeLimits.some((limit) => (limit.currentValue / limit.maxValue) * 100 >= 60) && (
                <div className="mt-8 rounded-lg bg-gradient-to-r from-primary/10 to-blue-500/10 p-6">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                        <div className="text-center sm:text-left">
                            <h3 className="mb-1 font-bold text-gray-900">
                                {t('billing.usage.needMore.title')}
                            </h3>
                            <p className="text-gray-600 text-sm">
                                {t('billing.usage.needMore.description')}
                            </p>
                        </div>
                        <a
                            href="/precios/propietarios"
                            className="rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
                        >
                            {t('billing.common.viewPlans')}
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
