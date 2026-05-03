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

import { Badge } from '@/components/shared/ui/Badge';
import type { ReviewCardData } from '@/data/types';
import { getInitialsFromName } from '@/lib/avatar-utils';
import { cn } from '@/lib/cn';
import {
    getAccommodationTypeColor,
    getDestinationBadgeColor,
    getMutedColorScheme
} from '@/lib/colors';
import type { SupportedLocale } from '@/lib/i18n';
import { QuotesIcon, StarIcon } from '@repo/icons';
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
    const badgeLabel =
        data.badge ??
        (data.entityType === 'accommodation'
            ? 'Alojamiento'
            : data.entityType === 'destination'
              ? 'Destino'
              : undefined);

    const entityUrl = buildEntityUrl(locale, data.entityType, data.entitySlug);

    /**
     * Contextual colour scheme for the entity badge.
     * Accommodation reviews reuse the "hotel" accent (we don't know the real
     * subtype at review-list time). Destination reviews use the dedicated
     * destination badge colour. Anything else falls back to the muted scheme.
     */
    const entityBadgeColorScheme = (() => {
        if (data.entityType === 'accommodation') {
            return getAccommodationTypeColor({ type: 'hotel' });
        }
        if (data.entityType === 'destination') {
            return getDestinationBadgeColor();
        }
        return getMutedColorScheme();
    })();

    const entityBadgeAriaLabel = entityUrl
        ? `Ver ${badgeLabel}: ${data.entityName ?? badgeLabel}`
        : `Tipo: ${badgeLabel}`;

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

            {/* Entity type badge — positioned slot owns layout; Badge owns colours. */}
            {badgeLabel && (
                <div className={styles.entityBadgeSlot}>
                    <Badge
                        label={badgeLabel}
                        href={entityUrl ?? undefined}
                        colorScheme={entityBadgeColorScheme}
                        size="xs"
                        ariaLabel={entityBadgeAriaLabel}
                    />
                </div>
            )}

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
                <ReviewerAvatar
                    url={data.reviewerAvatar ?? null}
                    alt={data.reviewerName}
                    initials={initials}
                />
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
