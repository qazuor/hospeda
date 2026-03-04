import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { UserAddon } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';

/**
 * Props for the ActiveAddons component
 */
export interface ActiveAddonsProps {
    /** Locale for i18n and date/currency formatting */
    readonly locale: SupportedLocale;
}

/** Status badge styling map */
const STATUS_STYLES: Readonly<Record<UserAddon['status'], string>> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    expiring_soon: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
} as const;

/** Status translation key map */
const STATUS_KEYS: Readonly<Record<UserAddon['status'], string>> = {
    active: 'subscription.addonStatusActive',
    expiring_soon: 'subscription.addonStatusExpiringSoon',
    expired: 'subscription.addonStatusExpired'
} as const;

/**
 * Active add-ons list for the user billing dashboard.
 * Displays the user's purchased add-ons with status, expiry, and cancel action.
 *
 * @example
 * ```tsx
 * <ActiveAddons locale="es" />
 * ```
 */
export function ActiveAddons({ locale }: ActiveAddonsProps) {
    const { t } = useTranslation({ locale, namespace: 'account' });

    const [addons, setAddons] = useState<UserAddon[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [cancellingIds, setCancellingIds] = useState<ReadonlySet<string>>(new Set());

    /** Fetch user add-ons from the API */
    const fetchAddons = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const result = await billingApi.getMyAddons();
            if (result.ok && result.data) {
                setAddons(result.data.addons);
            } else {
                setHasError(true);
            }
        } catch {
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddons();
    }, [fetchAddons]);

    /** Handle addon cancellation with confirmation dialog */
    const handleCancel = async (addonId: string, addonName: string) => {
        const confirmed = window.confirm(t('subscription.addonCancelConfirm'));
        if (!confirmed) return;

        setCancellingIds((prev) => new Set([...prev, addonId]));
        try {
            const result = await billingApi.cancelAddon({ addonId });
            if (result.ok) {
                addToast({ type: 'success', message: t('subscription.addonCancelSuccess') });
                // Optimistically remove from list
                setAddons((prev) => prev.filter((a) => a.id !== addonId));
            } else {
                addToast({ type: 'error', message: t('subscription.addonCancelError') });
            }
        } catch {
            addToast({ type: 'error', message: t('subscription.addonCancelError') });
        } finally {
            setCancellingIds((prev) => {
                const next = new Set(prev);
                next.delete(addonId);
                return next;
            });
        }

        // Keep name in scope to avoid unused var warning
        void addonName;
    };

    /** Format addon expiry date */
    const formatExpiry = (dateStr: string): string => {
        return formatDate({
            date: dateStr,
            locale: toBcp47Locale(locale),
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    };

    return (
        <section aria-labelledby="addons-heading">
            <h2
                id="addons-heading"
                className="mb-4 font-semibold text-lg text-text"
            >
                {t('subscription.addonsTitle')}
            </h2>

            {/* Loading skeleton */}
            {isLoading && (
                <div
                    className="space-y-3"
                    aria-busy="true"
                    aria-label={t('subscription.loading')}
                >
                    {(['sk-addon-0', 'sk-addon-1', 'sk-addon-2'] as const).map((id) => (
                        <div
                            key={id}
                            className="h-20 animate-pulse rounded-lg bg-surface-alt"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-sm text-text-secondary">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchAddons}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                        {t('subscription.retry')}
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasError && addons.length === 0 && (
                <div className="rounded-lg border border-border p-8 text-center">
                    <p className="text-sm text-text-secondary">{t('subscription.addonsEmpty')}</p>
                </div>
            )}

            {/* Add-ons list */}
            {!isLoading && !hasError && addons.length > 0 && (
                <ul className="space-y-3">
                    {addons.map((addon) => {
                        const isCancelling = cancellingIds.has(addon.id);
                        const canCancel =
                            addon.status === 'active' || addon.status === 'expiring_soon';

                        return (
                            <li
                                key={addon.id}
                                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-sm"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <h3 className="font-medium text-base text-text">
                                            {addon.name}
                                        </h3>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[addon.status]}`}
                                        >
                                            {t(STATUS_KEYS[addon.status])}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
                                        <span>
                                            {formatCurrency({
                                                value: addon.price / 100,
                                                currency: addon.currency,
                                                locale: toBcp47Locale(locale)
                                            })}
                                        </span>
                                        {addon.expiresAt && (
                                            <span>
                                                {t('subscription.addonExpiresAt', undefined, {
                                                    date: formatExpiry(addon.expiresAt)
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {canCancel && (
                                    <button
                                        type="button"
                                        onClick={() => handleCancel(addon.id, addon.name)}
                                        disabled={isCancelling}
                                        className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 font-medium text-red-600 text-sm transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                        aria-busy={isCancelling}
                                    >
                                        {isCancelling
                                            ? `${t('subscription.addonCancel')}...`
                                            : t('subscription.addonCancel')}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
