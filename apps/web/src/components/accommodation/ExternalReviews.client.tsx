/**
 * @file ExternalReviews.client.tsx
 * @description React island that renders up to three Google review snippets.
 *
 * Each card shows the author, a link to their profile when available, the star
 * rating, a locale-computed relative time, the review text clamped to five
 * lines with a "Leer más / Leer menos" toggle, and a muted "Escrita en …" note
 * when the review language differs from the page locale.
 *
 * The text is the guest's ORIGINAL wording (the adapter prefers Google's
 * `originalText`); the relative time is computed from `timeIso` in the
 * visitor's locale instead of using Google's English `relativeTime`.
 *
 * The island keeps the mandatory Google attribution ("Powered by Google").
 * Loaded with `client:visible` so it only hydrates when scrolled into view.
 */

import { GoogleIcon, StarIcon } from '@repo/icons';
import type { ExternalReviewSnippet } from '@repo/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getReviewLanguageLabel } from '@/lib/review-language';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './ExternalReviews.module.css';

/** Maximum number of review cards rendered. */
const VISIBLE_SNIPPETS = 3;

/** Google Places Terms of Service attribution link. */
const GOOGLE_ATTRIBUTION_HREF = 'https://www.google.com/maps';

interface Props {
    /** Review snippets from the external reputation block (Google only). */
    readonly snippets: readonly ExternalReviewSnippet[];
    /** Active locale for translations and relative time. */
    readonly locale: SupportedLocale;
}

/**
 * Renders a five-star visual for a 1–5 rating.
 *
 * @param params.rating - The rating to depict.
 * @param params.label - Accessible label for the whole group.
 */
function StarRating({ rating, label }: { readonly rating: number; readonly label: string }) {
    const clamped = Math.min(5, Math.max(0, Math.round(rating)));
    return (
        <span
            className={styles.starRating}
            role="img"
            aria-label={label}
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
 * A single review card with a measured "read more" clamp.
 *
 * The toggle only appears when the clamped text actually overflows its box.
 * The measurement runs after mount and on window resize, and is skipped while
 * expanded so the collapse control cannot disappear.
 */
function ReviewCard({
    snippet,
    locale
}: {
    readonly snippet: ExternalReviewSnippet;
    readonly locale: SupportedLocale;
}) {
    const { t } = createTranslations(locale);
    const textRef = useRef<HTMLParagraphElement>(null);
    const [isClamped, setIsClamped] = useState(false);
    const [expanded, setExpanded] = useState(false);

    /*
     * The author's profile URL comes from an outside platform through the API
     * and is stored without a scheme check, so it goes through the allow-list
     * like every other third-party URL the site links to (HOS-592 / F-02). A
     * refused value renders the plain name instead.
     */
    const authorHref = resolveSafeExternalUrl(snippet.authorUrl);

    const relativeTime = useMemo(() => {
        if (!snippet.timeIso) {
            return null;
        }
        const timestamp = new Date(snippet.timeIso).getTime();
        if (Number.isNaN(timestamp)) {
            return null;
        }
        return formatRelativeTime({ date: snippet.timeIso, locale });
    }, [snippet.timeIso, locale]);

    const languageLabel = getReviewLanguageLabel({
        languageCode: snippet.languageCode,
        locale
    });

    useEffect(() => {
        const element = textRef.current;
        if (!element || expanded) {
            return;
        }
        const measure = () => {
            setIsClamped(element.scrollHeight > element.clientHeight + 1);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [expanded]);

    return (
        <li className={styles.card}>
            <div className={styles.cardHeader}>
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
                    {authorHref ? (
                        <a
                            href={authorHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.authorLink}
                        >
                            {snippet.author}
                        </a>
                    ) : (
                        <span className={styles.author}>{snippet.author}</span>
                    )}

                    {/* Stars sit under the name, next to the date, so a long
                        author name keeps the full card width (3-column grid). */}
                    <div className={styles.subline}>
                        {snippet.rating != null && (
                            <StarRating
                                rating={snippet.rating}
                                label={t(
                                    'external-reputation.reviews.starsLabel',
                                    '{{count}} de 5 estrellas',
                                    { count: Math.min(5, Math.max(0, Math.round(snippet.rating))) }
                                )}
                            />
                        )}
                        {relativeTime && snippet.timeIso && (
                            <time
                                className={styles.relativeTime}
                                dateTime={snippet.timeIso}
                            >
                                {relativeTime}
                            </time>
                        )}
                    </div>
                </div>
            </div>

            <p
                ref={textRef}
                className={cn(styles.text, !expanded && styles.textClamped)}
            >
                {snippet.text}
            </p>

            {isClamped && (
                <button
                    type="button"
                    className={styles.readToggle}
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                >
                    {expanded
                        ? t('external-reputation.reviews.readLess', 'Leer menos')
                        : t('external-reputation.reviews.readMore', 'Leer más')}
                </button>
            )}

            {languageLabel && (
                <span className={styles.languageLabel}>
                    {t('external-reputation.reviews.writtenIn', 'Escrita en {{language}}', {
                        language: languageLabel
                    })}
                </span>
            )}
        </li>
    );
}

/**
 * Google review snippets island.
 *
 * Renders up to {@link VISIBLE_SNIPPETS} snippets with the Google attribution
 * required by the Places API Terms of Service.
 */
export function ExternalReviews({ snippets, locale }: Props) {
    const { t } = createTranslations(locale);
    const visible = useMemo(() => snippets.slice(0, VISIBLE_SNIPPETS), [snippets]);

    if (visible.length === 0) {
        return null;
    }

    return (
        <div className={styles.container}>
            <ul
                className={styles.list}
                aria-label={t('external-reputation.reviews.listLabel', 'Reseñas de Google')}
            >
                {visible.map((snippet) => (
                    <ReviewCard
                        key={`${snippet.author}:${(snippet.text ?? '').slice(0, 32)}`}
                        snippet={snippet}
                        locale={locale}
                    />
                ))}
            </ul>

            {/* Google Places ToS: "Powered by Google" attribution (verbatim). */}
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
