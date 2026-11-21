/**
 * AccountToastRegion — the one toast viewport of an account page
 * (HOS-2413 T-025, OD-11).
 *
 * `BaseLayout chrome="account"` mounts THIS instead of `ToastViewport`
 * (`chrome="site"` is unchanged), so a page has exactly one toast viewport.
 * It reads `store/toast-store` through `useSyncExternalStore` and drains a
 * toast queued by `queueToastForNextPage` on mount, so callers keep calling
 * `addToast` exactly as before.
 *
 * Two PERMANENT live regions, mounted even while empty so screen readers keep
 * the channel: a polite one for success, info and loading, and an assertive
 * one for danger. Neither takes focus.
 *
 * @module components/account/ui/AccountToastRegion
 */

import { useEffect, useSyncExternalStore } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import {
    drainPendingToast,
    getToasts,
    subscribe,
    type Toast as ToastModel
} from '@/store/toast-store';
import { cx } from './cx';
import { Toast } from './Toast';
import styles from './Toast.module.css';

const EMPTY_TOASTS: ReadonlyArray<ToastModel> = [];

/** The server renders no toasts. */
function getServerSnapshot(): ReadonlyArray<ToastModel> {
    return EMPTY_TOASTS;
}

/** Props of {@link AccountToastRegion}. */
export interface AccountToastRegionProps {
    /** Locale for the toast copy. */
    readonly locale: SupportedLocale;
}

/**
 * The account toast viewport.
 *
 * @param props - See {@link AccountToastRegionProps}.
 * @returns Two permanent live regions holding the active toasts.
 */
export function AccountToastRegion({ locale }: AccountToastRegionProps) {
    const toasts = useSyncExternalStore(subscribe, getToasts, getServerSnapshot);

    useEffect(() => {
        drainPendingToast();
    }, []);

    const polite = toasts.filter((toast) => toast.type !== 'error');
    const assertive = toasts.filter((toast) => toast.type === 'error');

    return (
        <div
            className={styles.region}
            data-account-toast-region=""
        >
            <div
                role="status"
                aria-live="polite"
                aria-atomic="false"
                className={styles.liveRegion}
            >
                {polite.map((toast) => (
                    <Toast
                        key={toast.id}
                        toast={toast}
                        locale={locale}
                    />
                ))}
            </div>
            <div
                role="alert"
                aria-live="assertive"
                aria-atomic="false"
                className={cx(styles.liveRegion)}
            >
                {assertive.map((toast) => (
                    <Toast
                        key={toast.id}
                        toast={toast}
                        locale={locale}
                    />
                ))}
            </div>
        </div>
    );
}
