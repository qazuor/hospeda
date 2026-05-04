/**
 * @file DestinationsIsland.client.tsx
 * @description Interactive destinations section island combining an SVG map
 * and an Embla carousel. The active destination index is shared between both
 * components so map pin clicks scroll the carousel, and carousel swipes
 * highlight the corresponding city pin.
 *
 * Layout:
 * - Desktop: Left column (map, 45%) + Right column (header + carousel + controls + CTA)
 * - Mobile: Only the carousel column (map is hidden via CSS)
 */

import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import { ErrorBoundary } from '@/components/shared/ui/ErrorBoundary';
import type { DestinationCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { StarIcon } from '@repo/icons';
import useEmblaCarousel from 'embla-carousel-react';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import styles from './DestinationsIsland.module.css';
import { DestinationsMap } from './DestinationsMap';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the DestinationsIsland component. */
interface DestinationsIslandProps {
    /** List of destination items ordered to match MAIN_CITIES map pins. */
    readonly destinations: readonly DestinationCardData[];
    /** Active locale used to build destination URLs and resolve translations. */
    readonly locale: SupportedLocale;
    /**
     * Whether the current user is authenticated.
     * Forwarded to FavoriteButton on each carousel card to decide between
     * toggle-favorite or showing the auth-required popover.
     * Defaults to false (guest user).
     */
    readonly isAuthenticated?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders star icons (filled/empty) for a given numeric rating.
 * Uses StarIcon from @repo/icons to stay consistent with grid card variant.
 */
function renderStars(rating: number): ReactElement[] {
    const fullStars = Math.round(rating);
    return Array.from({ length: 5 }, (_, i) => {
        const isFilled = i < fullStars;
        return (
            <span
                // biome-ignore lint/suspicious/noArrayIndexKey: static fixed-length star array, order never changes
                key={i}
                className={cn(styles.cardStar, !isFilled && styles.cardStarEmpty)}
                aria-hidden="true"
            >
                <StarIcon
                    size={14}
                    weight={isFilled ? 'fill' : 'regular'}
                />
            </span>
        );
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Main destinations island: interactive map + Embla carousel in two columns.
 *
 * State:
 * - `activeIndex`: which destination is active, shared between map and carousel.
 *
 * @param props - {@link DestinationsIslandProps}
 *
 * @example
 * ```astro
 * <DestinationsIsland destinations={destinations} locale={locale} isAuthenticated={!!user} client:visible />
 * ```
 */
export function DestinationsIsland(props: DestinationsIslandProps) {
    return (
        <ErrorBoundary>
            <DestinationsIslandInner {...props} />
        </ErrorBoundary>
    );
}

function DestinationsIslandInner({
    destinations,
    locale,
    isAuthenticated = false
}: DestinationsIslandProps) {
    const { t } = createTranslations(locale);

    const [activeIndex, setActiveIndex] = useState(0);
    const total = destinations.length;

    // Embla setup — centered alignment to show peek cards on both sides
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        align: 'center',
        slidesToScroll: 1
    });

    // Sync activeIndex → carousel when changed externally (map click or dot click)
    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.scrollTo(activeIndex);
    }, [emblaApi, activeIndex]);

    // Sync carousel scroll → activeIndex
    const onCarouselSelect = useCallback(() => {
        if (!emblaApi) return;
        setActiveIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on('select', onCarouselSelect);
        emblaApi.on('reInit', onCarouselSelect);
        return () => {
            emblaApi.off('select', onCarouselSelect);
            emblaApi.off('reInit', onCarouselSelect);
        };
    }, [emblaApi, onCarouselSelect]);

    // Arrow navigation
    const scrollPrev = useCallback(() => {
        if (!emblaApi) return;
        emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollNext = useCallback(() => {
        if (!emblaApi) return;
        emblaApi.scrollNext();
    }, [emblaApi]);

    // Keyboard arrow support on the carousel region
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!emblaApi) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                emblaApi.scrollPrev();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                emblaApi.scrollNext();
            }
        },
        [emblaApi]
    );

    const ctaHref = buildUrl({ locale, path: 'destinos' });

    return (
        <div className={styles.island}>
            {/* ---- Left column: interactive map ---- */}
            <div
                className={styles.mapColumn}
                aria-hidden="false"
            >
                <DestinationsMap
                    activeIndex={activeIndex}
                    onSelectDestination={setActiveIndex}
                    destinations={destinations}
                    mapLabel={t(
                        'destination.map.label',
                        'Interactive map of destinations in Entre Ríos, Argentina'
                    )}
                    pinLabel={(name) =>
                        t('destination.map.viewDestination', 'View destination {{name}}', { name })
                    }
                />
            </div>

            {/* ---- Right column: header + carousel + controls + CTA ---- */}
            <div className={styles.contentColumn}>
                {/* Section header */}
                <header className={styles.header}>
                    <p className={styles.tagline}>
                        {t('home.featuredDestinations.accentSubtitle', 'Explorá la región')}
                    </p>
                    <h2 className={styles.title}>
                        {t('home.featuredDestinations.title', 'Destinos populares')}
                    </h2>
                    <p className={styles.subtitle}>
                        {t(
                            'home.featuredDestinations.description',
                            'Explora los lugares más atractivos de la costa del río Uruguay en Entre Ríos.'
                        )}
                    </p>
                </header>

                {/* Embla carousel */}
                <section
                    className={styles.carouselRoot}
                    aria-roledescription="carousel"
                    aria-label={t('home.featuredDestinations.title', 'Destinos populares')}
                    onKeyDown={handleKeyDown}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: carousel needs keyboard focus for arrow-key navigation
                    tabIndex={0}
                >
                    <div
                        className={styles.carouselViewport}
                        ref={emblaRef}
                    >
                        <div className={styles.carouselTrack}>
                            {destinations.map((destination, i) => {
                                const isActive = i === activeIndex;
                                const href = buildUrl({ locale, path: destination.path });
                                const accommodationsLabel =
                                    destination.accommodationsCount === 1
                                        ? t(
                                              'destination.card.accommodation_singular',
                                              'alojamiento'
                                          )
                                        : t(
                                              'destination.card.accommodation_plural',
                                              'alojamientos'
                                          );
                                const ratingAriaLabel = `${t(
                                    'destination.card.rating.label',
                                    'Calificación'
                                )}: ${destination.averageRating.toFixed(1)} ${t(
                                    'destination.card.rating.of5',
                                    'de 5'
                                )}`;
                                const slideAriaLabel = t(
                                    'destination.carousel.slideOf',
                                    '{{current}} de {{total}}: {{name}}',
                                    {
                                        current: i + 1,
                                        total,
                                        name: destination.name
                                    }
                                );
                                const cardAriaLabel = t(
                                    'destination.carousel.viewDestination',
                                    'Ver destino {{name}}',
                                    { name: destination.name }
                                );

                                return (
                                    <article
                                        key={destination.slug}
                                        className={styles.slide}
                                        aria-roledescription="slide"
                                        aria-label={slideAriaLabel}
                                        style={{ position: 'relative' }}
                                    >
                                        <a
                                            href={href}
                                            className={cn(
                                                styles.card,
                                                isActive ? styles.cardActive : styles.cardBlurred
                                            )}
                                            aria-current={isActive ? 'true' : undefined}
                                            tabIndex={isActive ? 0 : -1}
                                            aria-label={cardAriaLabel}
                                            onClick={(e) => {
                                                if (!isActive) {
                                                    e.preventDefault();
                                                    setActiveIndex(i);
                                                }
                                            }}
                                        >
                                            {/* Background image */}
                                            <img
                                                src={destination.featuredImage.url}
                                                alt={
                                                    destination.featuredImage.caption ??
                                                    destination.name
                                                }
                                                className={styles.cardImage}
                                                loading="lazy"
                                                draggable={false}
                                                onError={(e) => {
                                                    const img = e.currentTarget as HTMLImageElement;
                                                    if (
                                                        img.src.endsWith(
                                                            '/assets/images/placeholder-destination.svg'
                                                        )
                                                    )
                                                        return;
                                                    img.src =
                                                        '/assets/images/placeholder-destination.svg';
                                                }}
                                            />

                                            {/* Gradient overlay */}
                                            <div
                                                className={styles.cardGradient}
                                                aria-hidden="true"
                                            />

                                            {/* Content */}
                                            <div className={styles.cardContent}>
                                                <h3 className={styles.cardTitle}>
                                                    {destination.name}
                                                </h3>
                                                <p className={styles.cardCount}>
                                                    {destination.accommodationsCount}{' '}
                                                    {accommodationsLabel}
                                                </p>
                                                <p className={styles.cardDescription}>
                                                    {destination.summary}
                                                </p>
                                                {destination.averageRating > 0 && (
                                                    <div
                                                        className={styles.cardRating}
                                                        aria-label={ratingAriaLabel}
                                                    >
                                                        <div className={styles.cardStars}>
                                                            {renderStars(destination.averageRating)}
                                                        </div>
                                                        <span className={styles.cardRatingValue}>
                                                            {destination.averageRating.toFixed(1)}
                                                        </span>
                                                        {destination.reviewsCount > 0 && (
                                                            <span
                                                                className={styles.cardReviewCount}
                                                            >
                                                                ({destination.reviewsCount})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </a>

                                        {/* FavoriteButton — outside the <a> to avoid nested interactive elements */}
                                        <div className={styles.cardActions}>
                                            <FavoriteButton
                                                entityId={destination.id}
                                                entityType="DESTINATION"
                                                isAuthenticated={isAuthenticated}
                                                locale={locale}
                                                variant="compact"
                                            />
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Slide counter + arrow navigation (replaces dots when >7 items) */}
                <nav
                    className={styles.controls}
                    aria-label={t('destination.carousel.navigation', 'Destination navigation')}
                >
                    <button
                        type="button"
                        className={styles.arrowButton}
                        onClick={scrollPrev}
                        aria-label={t('destination.carousel.previous', 'Previous destination')}
                    >
                        ←
                    </button>

                    <span
                        className={styles.slideCounter}
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label={t(
                            'destination.carousel.itemOf',
                            'Destination {{current}} of {{total}}',
                            { current: activeIndex + 1, total }
                        )}
                    >
                        {activeIndex + 1} / {total}
                    </span>

                    <button
                        type="button"
                        className={styles.arrowButton}
                        onClick={scrollNext}
                        aria-label={t('destination.carousel.next', 'Next destination')}
                    >
                        →
                    </button>
                </nav>

                {/* CTA */}
                <div className={styles.ctaWrapper}>
                    <a
                        href={ctaHref}
                        className={styles.ctaButton}
                        aria-label={t(
                            'home.featuredDestinations.viewAll',
                            'Ver todos los destinos'
                        )}
                    >
                        {t('home.featuredDestinations.viewAll', 'Ver todos los destinos')} →
                    </a>
                </div>
            </div>
        </div>
    );
}
