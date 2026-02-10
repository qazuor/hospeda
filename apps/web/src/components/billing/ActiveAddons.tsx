/**
 * ActiveAddons Component
 *
 * Displays user's active add-ons using the useAddons hook
 * Simplified version for dashboard display
 *
 * @module components/billing/ActiveAddons
 */

'use client';

import { useTranslations } from '@repo/i18n';
import { useAddons } from '../../hooks/useAddons';
import type { ActiveAddonPurchase } from '../../hooks/useAddons';

/**
 * Re-export type for backward compatibility
 */
export type { ActiveAddonPurchase };

/**
 * Format date in Spanish locale
 */
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

/**
 * Status badge class names by status
 */
const STATUS_CLASSES: Record<ActiveAddonPurchase['status'], string> = {
    active: 'bg-green-100 text-green-700',
    expiring_soon: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-gray-100 text-gray-700'
};

/**
 * ActiveAddons Component
 *
 * Displays active addon purchases with status, expiry, and quantity.
 * Uses the useAddons hook for data fetching.
 *
 * @example
 * ```tsx
 * <ActiveAddons />
 * ```
 *
 * @example
 * ```tsx
 * // Within BillingIsland with QZPayProvider
 * <BillingIsland client:load apiUrl="/api/v1">
 *   <ActiveAddons />
 * </BillingIsland>
 * ```
 */
export function ActiveAddons() {
    const { data: addons, isLoading, error } = useAddons();
    const { t } = useTranslations();

    if (isLoading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.addons.title')}
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
                    {t('billing.addons.title')}
                </h2>
                <div
                    className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
                    role="alert"
                >
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

    if (!addons || addons.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    {t('billing.addons.title')}
                </h2>
                <div className="py-12 text-center">
                    <svg
                        className="mx-auto mb-4 h-16 w-16 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                    </svg>
                    <h3 className="mb-2 font-bold text-gray-900 text-xl">
                        {t('billing.addons.empty.title')}
                    </h3>
                    <p className="mb-6 text-gray-600">{t('billing.addons.empty.description')}</p>
                    <a
                        href="/mi-cuenta/addons"
                        className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        {t('billing.addons.viewAvailable')}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">{t('billing.addons.title')}</h2>

            <div className="grid gap-6 md:grid-cols-2">
                {addons.map((addon) => {
                    const statusClass = STATUS_CLASSES[addon.status];
                    const isExpired = addon.status === 'expired';

                    return (
                        <div
                            key={addon.id}
                            className="rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-md"
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div>
                                    <h3 className="mb-1 font-bold text-gray-900 text-lg">
                                        {addon.name}
                                    </h3>
                                    <span
                                        className={`inline-block rounded-full px-3 py-1 font-medium text-sm ${statusClass}`}
                                    >
                                        {t(
                                            `billing.addons.status.${addon.status === 'expiring_soon' ? 'expiringSoon' : addon.status}`
                                        )}
                                    </span>
                                </div>
                            </div>

                            {addon.description && (
                                <p className="mb-4 text-gray-600 text-sm">{addon.description}</p>
                            )}

                            <div className="mb-4 space-y-2 text-sm">
                                {addon.quantity > 1 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            {t('billing.addons.quantity')}
                                        </span>
                                        <span className="font-medium text-gray-900">
                                            {addon.quantity}
                                        </span>
                                    </div>
                                )}
                                {addon.expiresAt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            {isExpired
                                                ? t('billing.addons.expiredOn')
                                                : t('billing.addons.expiresOn')}
                                        </span>
                                        <span
                                            className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}
                                        >
                                            {formatDate(new Date(addon.expiresAt))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {isExpired && (
                                <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                                    {t('billing.addons.expiredWarning')}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 text-center">
                <a
                    href="/mi-cuenta/addons"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    {t('billing.addons.buyMore')}
                </a>
            </div>
        </div>
    );
}
