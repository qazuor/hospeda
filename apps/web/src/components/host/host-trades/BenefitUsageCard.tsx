/**
 * @file BenefitUsageCard.tsx
 * @description One benefit-usage row, in the inbox or in the history (HOS-376 T-046).
 *
 * Presentational: every decision it renders is taken by the caller or by the
 * pure helpers in `@/lib/host/benefit-usage-view`. It holds no state and issues
 * no requests, so the panel above it owns the whole transition flow.
 */

import type { BenefitUsage } from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import { canUndoRejection, parseCalendarDate } from '@/lib/host/benefit-usage-view';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './BenefitUsagesPanel.module.css';

interface BenefitUsageCardProps {
    readonly locale: SupportedLocale;
    readonly usage: BenefitUsage;
    /** Renders the Confirm / Reject pair. Only true for the inbox. */
    readonly answerable?: boolean;
    /** True while a request for THIS row is in flight. */
    readonly busy?: boolean;
    readonly onConfirm?: (usage: BenefitUsage) => void;
    readonly onReject?: (usage: BenefitUsage) => void;
    readonly onUndoRejection?: (usage: BenefitUsage) => void;
    /** Opens the review dialog. Absent in the inbox, where nothing is confirmed yet. */
    readonly onReview?: (usage: BenefitUsage) => void;
}

/** Badge class per state, so the four are visually distinguishable at a glance. */
const BADGE_CLASS: Readonly<Record<BenefitUsage['status'], string>> = {
    PENDING: 'badgePending',
    CONFIRMED: 'badgeConfirmed',
    REJECTED: 'badgeRejected',
    EXPIRED: 'badgeExpired'
};

/** Fallback copy per state, so an untranslated key never surfaces raw. */
const STATUS_FALLBACK: Readonly<Record<BenefitUsage['status'], string>> = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido'
};

/**
 * Renders one usage: who the provider is, when the service happened, what state
 * the record is in, and whichever actions the row actually admits.
 *
 * @param props - The row, the locale, and the callbacks for its actions.
 * @returns The card element.
 */
export function BenefitUsageCard({
    locale,
    usage,
    answerable = false,
    busy = false,
    onConfirm,
    onReject,
    onUndoRejection,
    onReview
}: BenefitUsageCardProps) {
    const { t } = createTranslations(locale);

    // The provider should always resolve — the FK cascades — so this fallback is
    // a label, not a feature: one unresolved name must not leave a card with a
    // blank heading the host cannot make sense of.
    const providerName =
        usage.hostTrade?.name ??
        t('host-trades.usages.card.unknownProvider', 'Proveedor del directorio');

    const servicedOn = parseCalendarDate(usage.servicedAt);
    const servicedLabel = servicedOn ? formatDate({ date: servicedOn, locale }) : usage.servicedAt;

    const statusLabel = t(
        `host-trades.usages.status.${usage.status}`,
        STATUS_FALLBACK[usage.status]
    );

    const showUndo = canUndoRejection(usage);

    // Reviewing needs a CONFIRMED usage — the spec's hardest precondition — and
    // a provider the dialog can address. Offering it otherwise would walk the
    // host into a dialog whose only possible answer is 403 NO_CONFIRMED_USAGE.
    const showReview =
        usage.status === 'CONFIRMED' && usage.hostTrade !== null && onReview !== undefined;

    return (
        <li className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <h3 className={styles.cardTitle}>{providerName}</h3>
                    {usage.hostTrade ? (
                        <p className={styles.cardCategory}>
                            {t(
                                `host-trades.categories.${usage.hostTrade.category}`,
                                usage.hostTrade.category
                            )}
                        </p>
                    ) : null}
                </div>
                <span className={cn(styles.badge, styles[BADGE_CLASS[usage.status]])}>
                    {statusLabel}
                </span>
            </div>

            <p className={styles.cardMeta}>
                {t('host-trades.usages.card.servicedOn', 'Servicio del {{date}}', {
                    date: servicedLabel
                })}
                {' · '}
                {usage.declaredBy === 'HOST'
                    ? t('host-trades.usages.card.declaredByYou', 'Lo registraste vos')
                    : t('host-trades.usages.card.declaredByProvider', 'Lo registró el proveedor')}
            </p>

            {usage.note ? <p className={styles.cardNote}>“{usage.note}”</p> : null}

            {usage.status === 'REJECTED' && usage.rejectionNote ? (
                <p className={styles.cardNote}>
                    {t('host-trades.usages.card.rejectionNote', 'Motivo del rechazo: {{note}}', {
                        note: usage.rejectionNote
                    })}
                </p>
            ) : null}

            {answerable || showUndo || showReview ? (
                <div className={styles.cardActions}>
                    {answerable ? (
                        <>
                            <button
                                className={styles.primaryAction}
                                disabled={busy}
                                onClick={() => onConfirm?.(usage)}
                                type="button"
                            >
                                {t('host-trades.usages.actions.confirm', 'Confirmar')}
                            </button>
                            <button
                                className={styles.secondaryAction}
                                disabled={busy}
                                onClick={() => onReject?.(usage)}
                                type="button"
                            >
                                {t('host-trades.usages.actions.reject', 'Rechazar')}
                            </button>
                        </>
                    ) : null}

                    {showUndo ? (
                        <button
                            className={styles.secondaryAction}
                            disabled={busy}
                            onClick={() => onUndoRejection?.(usage)}
                            type="button"
                        >
                            {t('host-trades.usages.actions.undoRejection', 'Deshacer el rechazo')}
                        </button>
                    ) : null}

                    {showReview ? (
                        <button
                            className={styles.primaryAction}
                            disabled={busy}
                            onClick={() => onReview?.(usage)}
                            type="button"
                        >
                            {t('host-trades.review.cta', 'Valorar a {{name}}', {
                                name: providerName
                            })}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </li>
    );
}
