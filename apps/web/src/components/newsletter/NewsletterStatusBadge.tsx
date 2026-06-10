/**
 * @file NewsletterStatusBadge.tsx
 * @description Status badge used in the account newsletter preferences page
 * (and reusable by any future surface that needs to render the lifecycle
 * status with consistent colour + text). Carries both the colour signal and
 * the text label so users who can't perceive colour differences still
 * understand the state (AC-101-13.4).
 */

import styles from './NewsletterPreferences.module.css';

/** Subset of NewsletterSubscriberStatusEnum values consumed by this badge. */
export type NewsletterBadgeStatus =
    | 'active'
    | 'pending_verification'
    | 'unsubscribed'
    | 'bounced'
    | 'complained'
    | null;

export interface NewsletterStatusBadgeProps {
    readonly status: NewsletterBadgeStatus;
    // biome-ignore lint/suspicious/noExplicitAny: t-function signature varies by overload
    readonly t: (...args: any[]) => string;
}

const STATUS_MAP: Record<
    Exclude<NewsletterBadgeStatus, null>,
    { className: string; key: string; fallback: string }
> = {
    active: {
        className: styles.badgeActive,
        key: 'account.newsletter.statusActive',
        fallback: 'Activo'
    },
    pending_verification: {
        className: styles.badgePending,
        key: 'account.newsletter.statusPending',
        fallback: 'Pendiente de verificación'
    },
    unsubscribed: {
        className: styles.badgeNeutral,
        key: 'account.newsletter.statusUnsubscribed',
        fallback: 'No suscripto'
    },
    bounced: {
        className: styles.badgeError,
        key: 'account.newsletter.statusBounced',
        fallback: 'Email inválido'
    },
    complained: {
        className: styles.badgeError,
        key: 'account.newsletter.statusComplained',
        fallback: 'Cancelado'
    }
};

export function NewsletterStatusBadge({ status, t }: NewsletterStatusBadgeProps) {
    if (status === null) {
        return (
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                {t('account.newsletter.statusUnsubscribed', 'No suscripto')}
            </span>
        );
    }
    const cfg = STATUS_MAP[status];
    return <span className={`${styles.badge} ${cfg.className}`}>{t(cfg.key, cfg.fallback)}</span>;
}
