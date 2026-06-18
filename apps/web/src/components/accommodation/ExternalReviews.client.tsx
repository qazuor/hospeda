/**
 * @file ExternalReviews.client.tsx
 * @description React island that renders up to 5 Google review snippets with
 * author, relative time, star rating, text, author profile link, and the
 * mandatory Google attribution ("Powered by Google"). Loaded with
 * `client:visible` so it only hydrates when scrolled into view.
 *
 * AC-4.5: every snippet is clearly labeled with its source (Google).
 * Google Places display policy: "Powered by Google" link must appear.
 */

import { createTranslations } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { GoogleIcon, StarIcon } from '@repo/icons';
import type { ExternalReviewSnippet } from '@repo/schemas';
import styles from './ExternalReviews.module.css';

/** Maximum snippets rendered per spec (AC snippet limit). */
const MAX_SNIPPETS = 5;

/** Google Places Terms of Service attribution link. */
const GOOGLE_ATTRIBUTION_HREF = 'https://www.google.com/maps';

interface Props {
    /** Review snippets from the external reputation block (Google only). */
    readonly snippets: readonly ExternalReviewSnippet[];
    /** Active locale for translations. */
    readonly locale: SupportedLocale;
}

/**
 * Renders a single star-rating visual using filled/empty star icons.
 * Scale assumed to be 1-5 (Google Places returns 1-5).
 */
function StarRating({ rating }: { readonly rating: number }) {
    const clamped = Math.min(5, Math.max(0, Math.round(rating)));
    return (
        <span
            className={styles.starRating}
            aria-label={`${clamped} de 5 estrellas`}
        >
            {Array.from({ length: 5 }, (_, i) => (
                <StarIcon
                    // biome-ignore lint/suspicious/noArrayIndexKey: static positional array
                    key={i}
                    size="xs"
                    weight={i < clamped ? 'fill' : 'regular'}
                    color={i < clamped ? 'var(--brand-accent)' : 'var(--border)'}
                    aria-hidden="true"
                />
            ))}
        </span>
    );
}

/**
 * Google review snippets island.
 *
 * Renders up to {@link MAX_SNIPPETS} snippets with full Google attribution
 * as required by the Places API Terms of Service.
 */
export function ExternalReviews({ snippets, locale }: Props) {
    const { t } = createTranslations(locale);
    const visible = snippets.slice(0, MAX_SNIPPETS);

    if (visible.length === 0) {
        return null;
    }

    return (
        <div className={styles.container}>
            <ul
                className={styles.list}
                aria-label="Google Reviews"
            >
                {visible.map((snippet, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: snippets have no stable id
                    <li
                        key={idx}
                        className={styles.card}
                    >
                        <div className={styles.cardHeader}>
                            {/* Author avatar / photo */}
                            {snippet.profilePhoto ? (
                                <img
                                    src={snippet.profilePhoto}
                                    alt={snippet.author}
                                    className={styles.avatar}
                                    width={36}
                                    height={36}
                                    loading="lazy"
                                />
                            ) : (
                                <span
                                    className={styles.avatarFallback}
                                    aria-hidden="true"
                                >
                                    {snippet.author.slice(0, 1).toUpperCase()}
                                </span>
                            )}

                            <div className={styles.meta}>
                                {/* Author name — link to profile when available */}
                                {snippet.authorUrl ? (
                                    <a
                                        href={snippet.authorUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.authorLink}
                                    >
                                        {snippet.author}
                                    </a>
                                ) : (
                                    <span className={styles.author}>{snippet.author}</span>
                                )}

                                {/* Relative time (e.g. "hace 2 semanas") */}
                                {snippet.relativeTime && (
                                    <time
                                        className={styles.relativeTime}
                                        dateTime={snippet.timeIso ?? undefined}
                                    >
                                        {snippet.relativeTime}
                                    </time>
                                )}
                            </div>

                            {/* Star rating */}
                            {snippet.rating != null && <StarRating rating={snippet.rating} />}
                        </div>

                        {/* Review text */}
                        <p className={styles.text}>{snippet.text}</p>

                        {/* AC-4.5: source label */}
                        <span className={styles.sourceLabel}>
                            {t('external-reputation.snippets.on', 'en {{platform}}', {
                                platform: t('external-reputation.platform.google', 'Google')
                            })}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Google Places ToS: "Powered by Google" attribution */}
            <div className={styles.attribution}>
                <a
                    href={GOOGLE_ATTRIBUTION_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.attributionLink}
                    aria-label="Powered by Google"
                >
                    <GoogleIcon
                        size="xs"
                        aria-hidden="true"
                    />
                    <span>Powered by Google</span>
                </a>
            </div>
        </div>
    );
}
