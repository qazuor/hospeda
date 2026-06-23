/**
 * @file PlatformStatusChips.tsx
 * @description Per-platform async run status chip list for the owner
 * reputation panel (SPEC-250 Phase 7).
 *
 * Renders a compact status chip for each external platform that has a known
 * run/fetch status, using the data returned by `useReputationStatus`.
 *
 * Chip variants:
 *  - pending / running  → spinner chip "Actualizando..." + muted cached rating
 *  - idle + ok          → normal rating badge
 *  - idle + error|blocked|not_found → error chip with tooltip
 */

import { Spinner } from '@/components/shared/feedback/Spinner';
import type {
    FetchStatus,
    ReputationPlatformStatus,
    RunStatus
} from '@/hooks/use-reputation-status';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ReactElement } from 'react';
import styles from './ReputationStatus.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Human-readable platform label (pre-resolved by the parent). */
type PlatformLabel = string;

/** Entry passed in from the parent for each platform to render. */
export interface PlatformStatusEntry {
    readonly platform: string;
    readonly label: PlatformLabel;
    readonly status: ReputationPlatformStatus;
}

export interface PlatformStatusChipsProps {
    readonly locale: SupportedLocale;
    readonly platforms: readonly PlatformStatusEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the CSS class name for the chip based on runStatus + fetchStatus.
 */
function chipClass(runStatus: RunStatus, fetchStatus: FetchStatus): string {
    if (runStatus === 'pending') return styles.chipPending;
    if (runStatus === 'running') return styles.chipRunning;
    // idle
    if (fetchStatus === 'ok') return styles.chipOk;
    if (fetchStatus === 'blocked') return styles.chipBlocked;
    if (fetchStatus === 'not_found') return styles.chipNotFound;
    return styles.chipError;
}

/**
 * Returns the i18n key for the chip label based on runStatus + fetchStatus.
 */
function chipLabelKey(runStatus: RunStatus, fetchStatus: FetchStatus): string {
    if (runStatus === 'pending') return 'external-reputation.status.pending';
    if (runStatus === 'running') return 'external-reputation.status.running';
    // idle
    if (fetchStatus === 'error') return 'external-reputation.status.error';
    if (fetchStatus === 'blocked') return 'external-reputation.status.blocked';
    if (fetchStatus === 'not_found') return 'external-reputation.status.notFound';
    // ok — not shown as text label; rating renders inline
    return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Per-platform status chip list for the owner reputation panel.
 *
 * Each entry shows:
 * - A spinner chip when a platform is pending/running.
 * - A muted cached rating alongside the spinner (when available).
 * - A normal rating badge when idle + ok.
 * - An error chip with tooltip when idle + error/blocked/not_found.
 *
 * The wrapping `<ul>` carries `aria-live="polite"` so screen readers
 * announce state transitions without focus change.
 *
 * @param props - {@link PlatformStatusChipsProps}
 * @returns The status chip list, or null when the list is empty.
 */
export function PlatformStatusChips({
    locale,
    platforms
}: PlatformStatusChipsProps): ReactElement | null {
    const { t } = createTranslations(locale);

    if (platforms.length === 0) return null;

    return (
        <ul
            className={styles.statusList}
            aria-live="polite"
            aria-label={t('external-reputation.ownerConfig.title', 'Estado de plataformas')}
        >
            {platforms.map(({ platform, label, status }) => {
                const { runStatus, fetchStatus, rating } = status;
                const isInFlight = runStatus === 'pending' || runStatus === 'running';
                const labelKey = chipLabelKey(runStatus, fetchStatus);
                const chipText = labelKey ? t(labelKey as Parameters<typeof t>[0], labelKey) : null;

                return (
                    <li
                        key={platform}
                        className={styles.statusItem}
                    >
                        <span className={styles.statusPlatform}>{label}</span>

                        {/* In-flight: spinner chip + muted cached rating */}
                        {isInFlight && (
                            <>
                                <span
                                    className={`${styles.chip} ${chipClass(runStatus, fetchStatus)}`}
                                    aria-label={chipText ?? undefined}
                                >
                                    <Spinner
                                        size="sm"
                                        className={styles.chipSpinner}
                                    />
                                    {chipText}
                                </span>
                                {rating !== null && (
                                    <span className={styles.ratingMuted}>{String(rating)}</span>
                                )}
                            </>
                        )}

                        {/* Idle + ok: normal rating badge */}
                        {!isInFlight && fetchStatus === 'ok' && rating !== null && (
                            <span className={styles.ratingBadge}>{String(rating)}</span>
                        )}

                        {/* Idle + error / blocked / not_found: error chip with tooltip */}
                        {!isInFlight && fetchStatus !== 'ok' && (
                            <span
                                className={`${styles.chip} ${chipClass(runStatus, fetchStatus)}`}
                                title={t(
                                    `external-reputation.errors.${fetchStatus === 'not_found' ? 'notFound' : fetchStatus}` as Parameters<
                                        typeof t
                                    >[0],
                                    chipText ?? fetchStatus
                                )}
                                aria-label={chipText ?? fetchStatus}
                            >
                                {chipText}
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
