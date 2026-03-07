import { formatCurrency, formatDate, toBcp47Locale } from '@repo/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { UserAddon } from '../../lib/api/endpoints-protected';
import { billingApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';

/**
 * Props for the ActiveAddons component.
 */
export interface ActiveAddonsProps {
    /** Locale for i18n and date/currency formatting. */
    readonly locale: SupportedLocale;
}

/** Stable skeleton item keys for the loading state (avoids index key lint warning). */
const SKELETON_ADDON_KEYS = ['sk-addon-0', 'sk-addon-1', 'sk-addon-2'] as const;

/**
 * Status badge Tailwind class map.
 * Uses semantic color tokens that automatically adapt to dark mode via CSS custom properties.
 */
const STATUS_STYLES: Readonly<Record<UserAddon['status'], string>> = {
    active: 'bg-success/10 text-success',
    expiring_soon: 'bg-warning/10 text-warning-foreground',
    expired: 'bg-destructive/10 text-destructive'
} as const;

/**
 * Maps each addon status to its i18n translation key (short key, namespace is prepended by `t`).
 */
const STATUS_KEYS: Readonly<Record<UserAddon['status'], string>> = {
    active: 'subscription.addonStatusActive',
    expiring_soon: 'subscription.addonStatusExpiringSoon',
    expired: 'subscription.addonStatusExpired'
} as const;

/**
 * Active add-ons list for the user billing dashboard.
 * Fetches the authenticated user's purchased add-ons and displays them with
 * status badges, expiry dates, formatted prices, and a cancel action for
 * active or expiring-soon add-ons.
 *
 * Handles three states:
 * - **Loading**: animated skeleton rows
 * - **Error**: error message with retry button
 * - **Empty**: empty-state message
 * - **Loaded**: scrollable list of addon cards
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

    /**
     * Fetch the authenticated user's active addons from the protected API.
     * Wrapped in `useCallback` so it can safely be passed to the retry button.
     */
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

    /**
     * Handle addon cancellation.
     * Shows a native confirmation dialog, then calls the cancel endpoint.
     * On success, removes the addon optimistically from the local list.
     * On failure, shows an error toast.
     *
     * @param addonId - The ID of the addon to cancel.
     * @param _addonName - The display name (kept in scope for future use).
     */
    const handleCancel = async (addonId: string, _addonName: string): Promise<void> => {
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
    };

    /**
     * Format an addon expiry date as a localized short date string.
     *
     * @param dateStr - ISO date string to format.
     * @returns Localized date string (e.g. "15 ene 2025").
     */
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
                className="mb-4 font-semibold text-foreground text-lg"
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
                    {SKELETON_ADDON_KEYS.map((id) => (
                        <div
                            key={id}
                            className="h-20 animate-pulse rounded-lg bg-muted"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
                <div className="rounded-lg border border-border p-6 text-center">
                    <p className="mb-3 text-muted-foreground text-sm">
                        {t('subscription.loadError')}
                    </p>
                    <button
                        type="button"
                        onClick={fetchAddons}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('subscription.retry')}
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !hasError && addons.length === 0 && (
                <div className="rounded-lg border border-border p-8 text-center">
                    <p className="text-muted-foreground text-sm">{t('subscription.addonsEmpty')}</p>
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
                                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
                            >
                                <div className="min-w-0 flex-1">
                                    {/* Name + status badge */}
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <h3 className="font-medium text-base text-foreground">
                                            {addon.name}
                                        </h3>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[addon.status]}`}
                                        >
                                            {t(STATUS_KEYS[addon.status])}
                                        </span>
                                    </div>

                                    {/* Price + expiry */}
                                    <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
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

                                {/* Cancel button (only for active / expiring_soon) */}
                                {canCancel && (
                                    <button
                                        type="button"
                                        onClick={() => handleCancel(addon.id, addon.name)}
                                        disabled={isCancelling}
                                        aria-busy={isCancelling}
                                        className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2 disabled:opacity-50"
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
