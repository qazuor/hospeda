/**
 * @file ListingStatus.tsx
 * @description Async run / fetch status of one connected platform, as a kit
 * `StatusPill` (HOS-2515, replaces the legacy `PlatformStatusChips`).
 *
 * - pending / running: «Actualizando…» (info) next to the cached rating.
 * - idle and ok: the rating (success).
 * - idle and error / blocked / not found: the failure word (danger), with the
 *   longer explanation as a tooltip.
 *
 * The wrapper is a polite live region so a transition is announced without
 * moving focus. The word is always rendered: colour is never the only signal.
 */

import type { ReactElement } from 'react';
import { StatusPill } from '@/components/account/ui/StatusPill';
import type { ReputationPlatformStatus } from '@/hooks/use-reputation-status';
import type { TranslationFn } from '@/lib/i18n';
import styles from './ExternalReputation.module.css';

/** Props of {@link ListingStatus}. */
export interface ListingStatusProps {
    /** Status snapshot of the platform, when the status endpoint returned one. */
    readonly status: ReputationPlatformStatus | undefined;
    readonly t: TranslationFn;
}

/**
 * Status pill of one platform.
 *
 * @param props - See {@link ListingStatusProps}.
 * @returns The pill (inside a live region), or null when there is no status.
 */
export function ListingStatus({ status, t }: ListingStatusProps): ReactElement | null {
    if (status === undefined) return null;
    const { runStatus, fetchStatus, rating } = status;
    const inFlight = runStatus === 'pending' || runStatus === 'running';

    if (inFlight) {
        return (
            <span
                className={styles.statusSlot}
                aria-live="polite"
            >
                <StatusPill tone="info">{t(`external-reputation.status.${runStatus}`)}</StatusPill>
                {rating !== null && <span className={styles.cachedRating}>{String(rating)}</span>}
            </span>
        );
    }

    if (fetchStatus === 'ok') {
        if (rating === null) return null;
        return (
            <span
                className={styles.statusSlot}
                aria-live="polite"
            >
                <StatusPill tone="success">
                    {t('external-reputation.status.rating', undefined, { rating: String(rating) })}
                </StatusPill>
            </span>
        );
    }

    const wordKey = fetchStatus === 'not_found' ? 'notFound' : fetchStatus;
    return (
        <span
            className={styles.statusSlot}
            aria-live="polite"
            title={t(`external-reputation.errors.${wordKey}`)}
        >
            <StatusPill tone={fetchStatus === 'not_found' ? 'warning' : 'danger'}>
                {t(`external-reputation.status.${wordKey}`)}
            </StatusPill>
        </span>
    );
}
