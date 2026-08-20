/**
 * @file TradeCard.tsx
 * @description Presentational card for a single host trade (local service provider).
 *
 * Displays: name, category badge (localized), benefit text, contact button,
 * is24h badge (only when true), scheduleText (only when present), and the
 * stats line (only when the provider has any activity).
 *
 * What the stats line may claim is decided by {@link resolveTradeStats}, not
 * here — an average needs enough reviews behind it to be a rating rather than
 * one person's opinion, and the use/host pair has to travel together to stay
 * readable as the anti-collusion signal it is (§6.5).
 *
 * Contact href resolution:
 *   - http:// / https:// URLs → pass through as-is
 *   - Bare wa.me/... or wa.me?... (no scheme) → prepend https://
 *   - tel: values → pass through as-is
 *   - Anything else (raw phone number) → wrap in `tel:` (spaces/dashes stripped)
 *
 * Styling: CSS Modules + design tokens (no Tailwind).
 */

import type { HostTradePublic } from '@repo/schemas';
import type { JSX } from 'react';
import { formatNumber } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { buildUrl } from '@/lib/urls';
import { resolveTradeStats } from './resolve-trade-stats';
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
 *
 * Rules (applied in order, first match wins):
 * 1. An `http(s)` URL the scheme allow-list accepts → pass through.
 * 2. tel: value → pass through.
 * 3. Bare wa.me/... or wa.me?... (no scheme) → prepend https://.
 * 4. Anything else (raw phone, digits) → wrap in `tel:` with spaces/dashes stripped.
 *
 * Rule 1 asks {@link resolveSafeExternalUrl} rather than testing the string's
 * prefix itself (HOS-592 / F-02). `contact` is provider-authored, and a local
 * `startsWith('https://')` is a second copy of the rule that decides which
 * schemes may be linked — the kind of copy this codebase has already let drift
 * three times. The `tel:` fallback below is what an unsafe value degrades to,
 * so nothing here can produce an executable href.
 *
 * Exported for unit testing.
 */
export function resolveContactHref(contact: string): string {
    const trimmed = contact.trim();

    // Already a fully-qualified URL with a linkable scheme
    const externalHref = resolveSafeExternalUrl(trimmed);
    if (externalHref) {
        return externalHref;
    }

    // Already a tel: link
    if (trimmed.startsWith('tel:')) {
        return trimmed;
    }

    // Bare wa.me path (e.g. "wa.me/5493442567890" or "wa.me?phone=...")
    if (trimmed.startsWith('wa.me/') || trimmed.startsWith('wa.me?')) {
        const waHref = resolveSafeExternalUrl(`https://${trimmed}`);
        if (waHref) {
            return waHref;
        }
    }

    // Fallback: treat as raw phone number
    return `tel:${trimmed.replace(/[\s\-()]/g, '')}`;
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
    const { t, tPlural } = createTranslations(locale);

    const categoryLabel = t(`host-trades.categories.${trade.category}`, trade.category);
    const contactHref = resolveContactHref(trade.contact);
    const detailHref = buildUrl({
        locale,
        path: `mi-cuenta/directorio-proveedores/${trade.slug}`
    });
    const stats = resolveTradeStats({ trade });

    // One decimal, localised: "4,6" in es/pt, "4.6" in en. A raw 4.5999999
    // would otherwise reach the card exactly as the aggregate computed it.
    const ratingText =
        stats.average === null
            ? null
            : formatNumber({
                  value: stats.average,
                  locale,
                  options: { minimumFractionDigits: 1, maximumFractionDigits: 1 }
              });

    return (
        <article className={styles.card}>
            {/* ── Card header: name + category badge ── */}
            <div className={styles.cardHeader}>
                {/* The name is the way into the provider's page. A directory
                    reads that way, and it costs the card no new element —
                    "Contactar" stays the only button, so the primary action
                    keeps competing with nothing. */}
                <h3 className={styles.cardTitle}>
                    <a
                        className={styles.cardTitleLink}
                        href={detailHref}
                    >
                        {trade.name}
                    </a>
                </h3>
                <span className={styles.categoryBadge}>{categoryLabel}</span>
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

            {/* ── Stats: rating (only above the threshold) + the use pair ── */}
            {!stats.isEmpty && (
                <p className={styles.statsRow}>
                    {ratingText !== null && (
                        <span className={styles.statsRating}>
                            <span
                                aria-hidden="true"
                                className={styles.statsStar}
                            >
                                ★
                            </span>
                            <span aria-hidden="true">{ratingText}</span>
                            <span className={styles.srOnly}>
                                {t(
                                    'host-trades.card.stats.ratingLabel',
                                    '{{rating}} de 5 estrellas',
                                    {
                                        rating: ratingText
                                    }
                                )}
                            </span>
                        </span>
                    )}

                    {stats.reviewsCount > 0 && (
                        <span>
                            {tPlural('host-trades.card.stats.reviews', stats.reviewsCount, {
                                count: String(stats.reviewsCount)
                            })}
                        </span>
                    )}

                    {stats.confirmedUsesCount > 0 && (
                        <>
                            <span
                                aria-hidden="true"
                                className={styles.statsSeparator}
                            >
                                ·
                            </span>
                            <span>
                                {tPlural('host-trades.card.stats.uses', stats.confirmedUsesCount, {
                                    count: String(stats.confirmedUsesCount)
                                })}
                            </span>
                            <span
                                aria-hidden="true"
                                className={styles.statsSeparator}
                            >
                                ·
                            </span>
                            {/* Always next to the uses: the pair is the signal
                                (§6.5), and "40 usos" alone hides what "40 usos ·
                                2 anfitriones" gives away. */}
                            <span>
                                {tPlural('host-trades.card.stats.hosts', stats.distinctHostsCount, {
                                    count: String(stats.distinctHostsCount)
                                })}
                            </span>
                        </>
                    )}
                </p>
            )}

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
