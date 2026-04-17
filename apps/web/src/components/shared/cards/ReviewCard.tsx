/**
 * @file ReviewCard.tsx
 * @description React card component for review/testimonial items inside Embla carousels.
 *
 * Displays:
 * - A large decorative quote icon (background, low opacity)
 * - An entity type badge (top-right chip, clickable link if entitySlug is present)
 * - The review quote text in italic
 * - Individual star rating below the quote (stars only, no numeric value)
 * - Reviewer avatar, name, and origin (origin links to entity page if entitySlug present)
 * - Review date formatted as short month + year (e.g. "mar 2024")
 */

import type { ReviewCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { QuotesIcon, StarIcon } from '@repo/icons';
import styles from './ReviewCard.module.css';

/** Props for the ReviewCard component. */
interface ReviewCardProps {
    /** Review data to display on the card. */
    readonly data: ReviewCardData;
    /** Active locale used to build entity URLs. */
    readonly locale: SupportedLocale;
    /** Optional additional CSS classes for the card root element. */
    readonly className?: string;
}

/** Derive initials from a full name (first + last initial). */
function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0]?.[0] ?? 'U').toUpperCase();
    return `${(parts[0]?.[0] ?? '').toUpperCase()}${(parts[parts.length - 1]?.[0] ?? '').toUpperCase()}`;
}

/**
 * Format an ISO date string as a short month + year label using Intl.DateTimeFormat.
 *
 * @param isoDate - ISO 8601 date string (e.g. "2024-03-15T10:00:00Z")
 * @param locale - Active locale for formatting
 * @returns Formatted string like "mar. 2024" or empty string on invalid input
 */
function formatReviewDate(isoDate: string, locale: SupportedLocale): string {
    try {
        const date = new Date(isoDate);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
    } catch {
        return '';
    }
}

/**
 * Build the entity detail page URL based on entity type and locale.
 * Returns null when entitySlug is missing.
 *
 * @param locale - Active locale (e.g. 'es')
 * @param entityType - 'accommodation' or 'destination'
 * @param entitySlug - URL-safe slug for the entity
 */
function buildEntityUrl(
    locale: SupportedLocale,
    entityType: 'accommodation' | 'destination' | undefined,
    entitySlug: string | undefined
): string | null {
    if (!entitySlug || !entityType) return null;
    if (entityType === 'accommodation') return `/${locale}/alojamientos/${entitySlug}/`;
    if (entityType === 'destination') return `/${locale}/destinos/${entitySlug}/`;
    return null;
}

/**
 * Review / testimonial card component designed for use inside Embla carousel slides.
 *
 * Renders a large decorative QuotesIcon as a background element, the quote
 * text in italic (slightly enlarged), an individual star rating row (stars only),
 * an optional entity type badge (clickable link when entitySlug is available),
 * and the reviewer's name + origin (origin links to the entity page when entitySlug
 * is available).
 *
 * @param props - {@link ReviewCardProps}
 * @returns A React element representing the review card.
 *
 * @example
 * ```tsx
 * <ReviewCard data={review} locale="es" />
 * ```
 */
export function ReviewCard({ data, locale, className }: ReviewCardProps) {
    const filledStars = Math.floor(data.rating);
    const initials = data.initials ?? getInitials(data.reviewerName);
    const badgeLabel =
        data.badge ??
        (data.entityType === 'accommodation'
            ? 'Alojamiento'
            : data.entityType === 'destination'
              ? 'Destino'
              : undefined);

    const entityUrl = buildEntityUrl(locale, data.entityType, data.entitySlug);

    return (
        <figure
            className={cn(styles.card, className)}
            aria-label={`Reseña de ${data.reviewerName}`}
        >
            {/* Decorative large quote icon — background, low opacity */}
            <QuotesIcon
                size={80}
                weight="fill"
                className={styles.quoteIcon}
                aria-hidden="true"
            />

            {/* Entity type badge — top-right chip, links to entity when slug available */}
            {badgeLabel &&
                (entityUrl ? (
                    <a
                        href={entityUrl}
                        className={styles.entityBadgeLink}
                        aria-label={`Ver ${badgeLabel}: ${data.entityName ?? badgeLabel}`}
                    >
                        {badgeLabel}
                    </a>
                ) : (
                    <span
                        className={styles.entityBadge}
                        aria-label={`Tipo: ${badgeLabel}`}
                    >
                        {badgeLabel}
                    </span>
                ))}

            {/* Quote text */}
            <blockquote>
                <p className={styles.quoteText}>&ldquo;{data.quote}&rdquo;</p>
            </blockquote>

            {/* Individual star rating — stars only, no numeric value */}
            <div
                className={styles.reviewRating}
                aria-label={`Calificación: ${data.rating} de 5`}
            >
                <div
                    className={styles.reviewStars}
                    aria-hidden="true"
                >
                    {Array.from({ length: 5 }).map((_, i) => (
                        <StarIcon
                            // biome-ignore lint/suspicious/noArrayIndexKey: static decorative list
                            key={`review-star-${i}`}
                            size={13}
                            weight="fill"
                            className={cn(
                                styles.reviewStarIcon,
                                i < filledStars && styles.reviewStarIconFilled
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Author info */}
            <figcaption className={styles.caption}>
                {data.reviewerAvatar ? (
                    <img
                        src={data.reviewerAvatar}
                        alt={data.reviewerName}
                        className={styles.avatar}
                        width={40}
                        height={40}
                        loading="lazy"
                    />
                ) : (
                    <span
                        className={styles.avatarInitials}
                        aria-hidden="true"
                    >
                        {initials}
                    </span>
                )}
                <div className={styles.authorInfo}>
                    <span className={styles.authorName}>{data.reviewerName}</span>
                    <span className={styles.authorMeta}>
                        {entityUrl ? (
                            <a
                                href={entityUrl}
                                className={styles.authorOriginLink}
                                aria-label={`Ver ${data.entityName ?? data.reviewerOrigin}`}
                            >
                                {data.reviewerOrigin}
                            </a>
                        ) : (
                            <span className={styles.authorOrigin}>{data.reviewerOrigin}</span>
                        )}
                        {data.date && (
                            <>
                                {' · '}
                                <span className={styles.reviewDate}>
                                    {formatReviewDate(data.date, locale)}
                                </span>
                            </>
                        )}
                    </span>
                </div>
            </figcaption>
        </figure>
    );
}
