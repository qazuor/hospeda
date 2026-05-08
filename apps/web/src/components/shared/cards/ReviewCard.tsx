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
import { getInitialsFromName } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { AccommodationIcon, CompassIcon, QuotesIcon, StarIcon } from '@repo/icons';
import { useState } from 'react';
import styles from './ReviewCard.module.css';

/**
 * Avatar with initials fallback. The initials span is always rendered as a
 * sibling so when the <img> fails to load (404, CORS) we hide the broken
 * <img> via state and the initials show through.
 */
function ReviewerAvatar({
    url,
    alt,
    initials
}: { readonly url: string | null; readonly alt: string; readonly initials: string }) {
    const [broken, setBroken] = useState(false);
    const showImg = url && !broken;
    return (
        <span className={styles.avatarWrapper}>
            {showImg && (
                <img
                    src={url}
                    alt={alt}
                    className={styles.avatar}
                    width={40}
                    height={40}
                    loading="lazy"
                    onError={() => setBroken(true)}
                />
            )}
            <span
                className={styles.avatarInitials}
                aria-hidden={showImg ? 'true' : undefined}
            >
                {initials}
            </span>
        </span>
    );
}

/** Props for the ReviewCard component. */
interface ReviewCardProps {
    /** Review data to display on the card. */
    readonly data: ReviewCardData;
    /** Active locale used to build entity URLs. */
    readonly locale: SupportedLocale;
    /** Optional additional CSS classes for the card root element. */
    readonly className?: string;
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
    const initials = data.initials ?? getInitialsFromName(data.reviewerName);

    const entityUrl = buildEntityUrl(locale, data.entityType, data.entitySlug);
    const entityName = data.entityName ?? data.reviewerOrigin;

    /**
     * Eyebrow label + icon for the entity-type pill above the title.
     * Communicates whether the review targets an accommodation or a
     * destination at a glance, replacing the previous tiny top-right
     * badge that was easy to miss.
     */
    const isAccommodation = data.entityType === 'accommodation';
    const isDestination = data.entityType === 'destination';
    const typeLabel = isAccommodation
        ? locale === 'en'
            ? 'Accommodation'
            : locale === 'pt'
              ? 'Hospedagem'
              : 'Alojamiento'
        : isDestination
          ? locale === 'en'
              ? 'Destination'
              : 'Destino'
          : null;

    return (
        <figure
            className={cn(styles.card, className)}
            aria-label={`Reseña sobre ${entityName} de ${data.reviewerName}`}
        >
            {/* Decorative large quote icon — background, low opacity */}
            <QuotesIcon
                size={80}
                weight="fill"
                className={styles.quoteIcon}
                aria-hidden="true"
            />

            {/* Entity header — the most important question on a review card is
                'review of WHAT?'. The eyebrow row tells the reader the entity
                type (accommodation vs destination) with an icon, the H3 below
                names it. */}
            {entityName && (
                <div className={styles.entityHeader}>
                    {typeLabel && (
                        <p
                            className={cn(
                                styles.entityType,
                                isDestination
                                    ? styles.entityTypeDestination
                                    : styles.entityTypeAccommodation
                            )}
                        >
                            {isAccommodation && (
                                <AccommodationIcon
                                    size={14}
                                    weight="fill"
                                    aria-hidden="true"
                                />
                            )}
                            {isDestination && (
                                <CompassIcon
                                    size={14}
                                    weight="fill"
                                    aria-hidden="true"
                                />
                            )}
                            <span>{typeLabel}</span>
                        </p>
                    )}
                    <h3 className={styles.entityName}>
                        {entityUrl ? (
                            <a
                                href={entityUrl}
                                className={styles.entityNameLink}
                                aria-label={`Ver ${entityName}`}
                            >
                                {entityName}
                            </a>
                        ) : (
                            entityName
                        )}
                    </h3>
                </div>
            )}

            {/* Quote text */}
            <blockquote className={styles.quoteWrapper}>
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

            {/* Reviewer footer — compact: avatar + name · date in a single row.
                The entity has its own H3 above so this row is supporting metadata. */}
            <figcaption className={styles.caption}>
                <ReviewerAvatar
                    url={data.reviewerAvatar ?? null}
                    alt={data.reviewerName}
                    initials={initials}
                />
                <span className={styles.authorRow}>
                    <span className={styles.authorName}>{data.reviewerName}</span>
                    {data.date && (
                        <>
                            <span
                                className={styles.authorSeparator}
                                aria-hidden="true"
                            >
                                ·
                            </span>
                            <span className={styles.reviewDate}>
                                {formatReviewDate(data.date, locale)}
                            </span>
                        </>
                    )}
                </span>
            </figcaption>
        </figure>
    );
}
