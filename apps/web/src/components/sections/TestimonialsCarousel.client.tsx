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

import { ReviewCard } from '@/components/shared/cards/ReviewCard';
import { ErrorBoundary } from '@/components/shared/ui/ErrorBoundary';
import { IconButton } from '@/components/ui/IconButtonReact';
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

/** Breakpoint at which the carousel switches from 1 to 2 active slides. */
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function TestimonialsCarouselInner({
    reviews,
    locale,
    autoplayDelay = 7000
}: TestimonialsCarouselProps) {
    const { t } = createTranslations(locale);
    const [selectedSnap, setSelectedSnap] = useState(0);
    const [snapCount, setSnapCount] = useState(0);
    /**
     * Slides per snap group. 1 on mobile (only one card centered), 2 on
     * desktop (two cards visible side-by-side). Defaults to desktop on the
     * server so SSR markup matches what desktop users render first; the
     * matchMedia listener corrects it on mount for mobile clients.
     */
    const [slidesPerGroup, setSlidesPerGroup] = useState<1 | 2>(2);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Autoplay plugin ref
    const autoplayPlugin = useRef(Autoplay({ delay: autoplayDelay, stopOnInteraction: false }));

    const [mainRef, mainApi] = useEmblaCarousel(
        {
            loop: true,
            align: 'center',
            containScroll: false,
            slidesToScroll: 1,
            breakpoints: {
                [DESKTOP_MEDIA_QUERY]: { slidesToScroll: 2 }
            }
        },
        [autoplayPlugin.current]
    );

    // Track viewport so isActiveSlide and snap-count math match Embla's own
    // breakpoint-driven slidesToScroll value.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia(DESKTOP_MEDIA_QUERY);
        setSlidesPerGroup(mq.matches ? 2 : 1);
        const handler = (e: MediaQueryListEvent) => setSlidesPerGroup(e.matches ? 2 : 1);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Sync state on slide change. With `loop: true` the prev/next arrows are
    // always enabled, so we don't track canScrollPrev/canScrollNext.
    const onSelect = useCallback(() => {
        if (!mainApi) return;
        setSelectedSnap(mainApi.selectedScrollSnap());
    }, [mainApi]);

    useEffect(() => {
        if (!mainApi) return;
        setSnapCount(mainApi.scrollSnapList().length);
        mainApi.on('select', onSelect);
        mainApi.on('reInit', onSelect);
        onSelect();
        return () => {
            mainApi.off('select', onSelect);
            mainApi.off('reInit', onSelect);
        };
    }, [mainApi, onSelect]);

    // Refresh snap count whenever Embla re-runs at a breakpoint change.
    useEffect(() => {
        if (!mainApi) return;
        const handler = () => setSnapCount(mainApi.scrollSnapList().length);
        mainApi.on('reInit', handler);
        return () => {
            mainApi.off('reInit', handler);
        };
    }, [mainApi]);

    /**
     * Check whether a slide is part of the currently active (non-peek)
     * group. The group size matches Embla's `slidesToScroll` for the
     * current viewport: 1 slide on mobile, 2 on desktop.
     */
    const isActiveSlide = useCallback(
        (index: number): boolean => {
            if (!mainApi) return false;
            const groupStart = selectedSnap * slidesPerGroup;
            return index >= groupStart && index < groupStart + slidesPerGroup;
        },
        [mainApi, selectedSnap, slidesPerGroup]
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
                <IconButton
                    ariaLabel={t('review.carousel.previous', 'Previous testimonial')}
                    variant="outline"
                    size="sm"
                    onClick={scrollPrev}
                    className={cn(styles.arrow, styles.arrowPrev)}
                >
                    <ChevronLeftIcon
                        size={20}
                        weight="bold"
                        aria-hidden="true"
                    />
                </IconButton>

                {/* Main carousel */}
                {/* biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" + aria-roledescription="carousel" is the WAI-ARIA APG carousel pattern. */}
                <div
                    role="group"
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
                            // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" + aria-roledescription="slide" is the WAI-ARIA APG carousel-slide pattern.
                            <div
                                role="group"
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
                <IconButton
                    ariaLabel={t('review.carousel.next', 'Next testimonial')}
                    variant="outline"
                    size="sm"
                    onClick={scrollNext}
                    className={cn(styles.arrow, styles.arrowNext)}
                >
                    <ChevronRightIcon
                        size={20}
                        weight="bold"
                        aria-hidden="true"
                    />
                </IconButton>
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
