/**
 * @file TestimonialsCarousel.client.tsx
 * @description React island for the homepage testimonials section.
 *
 * Renders a peek-layout carousel with:
 * - Main carousel: ReviewCard slides with autoplay
 *   (desktop: 2 cards visible side by side with peek on both edges; mobile: 1 card with peek)
 * - Prev/next arrow buttons
 * - Pill-dot navigation aligned to scroll snap groups
 * - Autoplay pauses on hover and focus-within for accessibility
 */

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ReviewCard } from '@/components/shared/ReviewCard';
import type { ReviewCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './TestimonialsCarousel.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the TestimonialsCarousel component. */
interface TestimonialsCarouselProps {
    /** Array of review data items to display. */
    readonly reviews: readonly ReviewCardData[];
    /** Active locale for i18n formatting. */
    readonly locale: SupportedLocale;
    /**
     * Autoplay delay in milliseconds between slides.
     * @default 7000
     */
    readonly autoplayDelay?: number;
}

// ---------------------------------------------------------------------------
// TestimonialsCarousel
// ---------------------------------------------------------------------------

/**
 * Peek-layout carousel for testimonials with prev/next arrows and pill-dot navigation.
 * Shows 2 cards side by side on desktop (with peek on both edges), 1 card with peek on mobile.
 *
 * @example
 * ```tsx
 * <TestimonialsCarousel
 *   reviews={reviews}
 *   locale="es"
 *   client:visible
 * />
 * ```
 */
export function TestimonialsCarousel(props: TestimonialsCarouselProps) {
    return (
        <ErrorBoundary>
            <TestimonialsCarouselInner {...props} />
        </ErrorBoundary>
    );
}

function TestimonialsCarouselInner({
    reviews,
    locale,
    autoplayDelay = 7000
}: TestimonialsCarouselProps) {
    const { t } = createTranslations(locale);
    const [selectedSnap, setSelectedSnap] = useState(0);
    const [snapCount, setSnapCount] = useState(0);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Autoplay plugin ref
    const autoplayPlugin = useRef(Autoplay({ delay: autoplayDelay, stopOnInteraction: false }));

    const [mainRef, mainApi] = useEmblaCarousel(
        {
            loop: true,
            align: 'center',
            containScroll: false,
            slidesToScroll: 2
        },
        [autoplayPlugin.current]
    );

    // Sync state on slide change
    const onSelect = useCallback(() => {
        if (!mainApi) return;
        setSelectedSnap(mainApi.selectedScrollSnap());
        setCanScrollPrev(mainApi.canScrollPrev());
        setCanScrollNext(mainApi.canScrollNext());
    }, [mainApi]);

    useEffect(() => {
        if (!mainApi) return;
        setSnapCount(mainApi.scrollSnapList().length);
        mainApi.on('select', onSelect);
        onSelect();
        return () => {
            mainApi.off('select', onSelect);
        };
    }, [mainApi, onSelect]);

    /**
     * Check if a slide index is one of the 2 active (non-peek) slides.
     * With slidesToScroll:2 and loop, Embla maps each snap to a group of 2 slides.
     * We use the snap's slide indices from the engine for accuracy.
     */
    const isActiveSlide = useCallback(
        (index: number): boolean => {
            if (!mainApi) return false;
            const snapSlides = mainApi.internalEngine().slideRegistry;
            const currentGroup = snapSlides[selectedSnap];
            if (!currentGroup) return false;
            return currentGroup.includes(index);
        },
        [mainApi, selectedSnap]
    );

    // Navigation callbacks
    const scrollPrev = useCallback(() => mainApi?.scrollPrev(), [mainApi]);
    const scrollNext = useCallback(() => mainApi?.scrollNext(), [mainApi]);
    const scrollToSnap = useCallback((snap: number) => mainApi?.scrollTo(snap), [mainApi]);

    // Pause autoplay on hover / focus
    const handleMouseEnter = useCallback(() => autoplayPlugin.current.stop(), []);
    const handleMouseLeave = useCallback(() => autoplayPlugin.current.play(), []);
    const handleFocusIn = useCallback(() => autoplayPlugin.current.stop(), []);
    const handleFocusOut = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
            autoplayPlugin.current.play();
        }
    }, []);

    if (reviews.length === 0) return null;

    return (
        <div
            ref={wrapperRef}
            className={styles.wrapper}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocusIn}
            onBlur={handleFocusOut}
        >
            {/* Carousel viewport with arrows */}
            <div className={styles.carouselArea}>
                {/* Prev arrow */}
                <button
                    type="button"
                    className={cn(styles.arrow, styles.arrowPrev)}
                    onClick={scrollPrev}
                    disabled={!canScrollPrev}
                    aria-label={t('review.carousel.previous', 'Previous testimonial')}
                >
                    <ChevronLeftIcon
                        size={20}
                        weight="bold"
                        aria-hidden="true"
                    />
                </button>

                {/* Main carousel */}
                <div
                    ref={mainRef}
                    className={styles.mainViewport}
                    aria-roledescription="carousel"
                    aria-label={t('review.carousel.title', 'Guest testimonials')}
                >
                    <div
                        className={styles.mainTrack}
                        aria-live="polite"
                        aria-atomic="false"
                    >
                        {reviews.map((review, index) => (
                            <div
                                key={review.id}
                                className={cn(
                                    styles.mainSlide,
                                    isActiveSlide(index) && styles.mainSlideActive
                                )}
                                aria-roledescription="slide"
                                aria-label={t(
                                    'review.carousel.itemOf',
                                    'Testimonial {{current}} of {{total}}',
                                    { current: index + 1, total: reviews.length }
                                )}
                                aria-hidden={!isActiveSlide(index)}
                            >
                                <div className={styles.slideCard}>
                                    <ReviewCard
                                        data={review}
                                        locale={locale}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Next arrow */}
                <button
                    type="button"
                    className={cn(styles.arrow, styles.arrowNext)}
                    onClick={scrollNext}
                    disabled={!canScrollNext}
                    aria-label={t('review.carousel.next', 'Next testimonial')}
                >
                    <ChevronRightIcon
                        size={20}
                        weight="bold"
                        aria-hidden="true"
                    />
                </button>
            </div>

            {/* Pill-dot navigation — 1 dot per scroll snap group */}
            <div
                className={styles.dotsWrapper}
                role="tablist"
                aria-label={t('review.carousel.navigate', 'Navigate between testimonials')}
            >
                {Array.from({ length: snapCount }).map((_, snapIndex) => (
                    <button
                        // biome-ignore lint/suspicious/noArrayIndexKey: snap indices are stable
                        key={`snap-${snapIndex}`}
                        type="button"
                        role="tab"
                        aria-selected={snapIndex === selectedSnap}
                        aria-label={t('review.carousel.group', 'Testimonial group {{number}}', {
                            number: snapIndex + 1
                        })}
                        onClick={() => scrollToSnap(snapIndex)}
                        className={cn(styles.dot, snapIndex === selectedSnap && styles.dotActive)}
                    />
                ))}
            </div>
        </div>
    );
}
