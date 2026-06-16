/**
 * @file TradeCard.tsx
 * @description Presentational card for a single host trade (local service provider).
 *
 * Displays: name, category badge (localized), benefit text, contact button,
 * is24h badge (only when true), scheduleText (only when present).
 *
 * Contact href resolution:
 *   - URL-like strings (http://, https://, wa.me, tel:) → used as-is as href
 *   - Anything else (raw phone, digits) → `tel:<contact>`
 *
 * Styling: CSS Modules + design tokens (no Tailwind).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { HostTradePublic } from '@repo/schemas';
import type { JSX } from 'react';
import styles from './TradeCard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradeCardProps {
    /** The trade entity to render */
    readonly trade: HostTradePublic;
    /** Active UI locale for i18n */
    readonly locale: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the contact string to a safe href.
 * - Already looks like a URL → use as-is.
 * - Raw phone / text → wrap in `tel:`.
 */
function resolveContactHref(contact: string): string {
    const trimmed = contact.trim();
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('wa.me') ||
        trimmed.startsWith('tel:')
    ) {
        return trimmed;
    }
    // Strip spaces and dashes for tel: links so dialers can handle them
    return `tel:${trimmed.replace(/\s+/g, '')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TradeCard — displays a single host trade entry with localized fields.
 *
 * @example
 * ```tsx
 * <TradeCard trade={trade} locale="es" />
 * ```
 */
export function TradeCard({ trade, locale }: TradeCardProps): JSX.Element {
    const { t } = createTranslations(locale);

    const categoryLabel = t(`host-trades.categories.${trade.category}`, trade.category);
    const contactHref = resolveContactHref(trade.contact);

    return (
        <article className={styles.card}>
            {/* ── Card header: name + category badge ── */}
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{trade.name}</h3>
                <span
                    className={styles.categoryBadge}
                    aria-label={categoryLabel}
                >
                    {categoryLabel}
                </span>
            </div>

            {/* ── is24h badge ── */}
            {trade.is24h && (
                <div className={styles.badge24h}>
                    {t('host-trades.card.is24h', 'Disponible 24hs')}
                </div>
            )}

            {/* ── Schedule text (when present and not 24h) ── */}
            {!trade.is24h && trade.scheduleText != null && trade.scheduleText.length > 0 && (
                <p className={styles.scheduleText}>{trade.scheduleText}</p>
            )}

            {/* ── Benefit text ── */}
            <div className={styles.benefitRow}>
                <span className={styles.benefitLabel}>
                    {t('host-trades.card.benefit', 'Beneficio para hosts')}
                </span>
                <p className={styles.benefitText}>{trade.benefit}</p>
            </div>

            {/* ── Contact button ── */}
            <a
                href={contactHref}
                className={styles.contactButton}
                target={contactHref.startsWith('http') ? '_blank' : undefined}
                rel={contactHref.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
                {t('host-trades.card.contact', 'Contactar')}
            </a>
        </article>
    );
}
