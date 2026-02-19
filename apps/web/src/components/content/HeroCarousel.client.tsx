import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single carousel slide containing an image source and accessible alt text.
 */
export interface HeroCarouselSlide {
    /** Absolute or relative URL of the slide image. */
    readonly src: string;
    /** Descriptive alt text used for screen readers. */
    readonly alt: string;
}

/**
 * Props for the {@link HeroCarousel} component.
 */
/**
 * Localised labels for carousel accessibility strings.
 */
export interface HeroCarouselLabels {
    /** aria-label for the carousel region (e.g. "Image carousel"). */
    readonly carouselAriaLabel: string;
    /** Visually-hidden legend for the dot navigation fieldset. */
    readonly slideNavLegend: string;
    /**
     * Template for individual dot aria-labels.
     * Receives `{current}` and `{total}` placeholders.
     * @example "Go to image {current} of {total}"
     */
    readonly dotAriaLabel: string;
    /**
     * Template for the aria-live announcement.
     * Receives `{current}`, `{total}`, and `{alt}` placeholders.
     * @example "Image {current} of {total}: {alt}"
     */
    readonly liveRegionText: string;
}

export interface HeroCarouselProps {
    /**
     * Ordered list of slides to display.
     * If empty, a gradient fallback is rendered instead.
     */
    readonly slides: ReadonlyArray<HeroCarouselSlide>;
    /** Localised accessibility strings. */
    readonly labels: HeroCarouselLabels;
    /**
     * Milliseconds between automatic slide advances.
     * @default 6000
     */
    readonly autoAdvanceMs?: number;
    /**
     * Milliseconds for the CSS opacity transition between slides.
     * Ignored when the user prefers reduced motion.
     * @default 1000
     */
    readonly transitionMs?: number;
}

// ---------------------------------------------------------------------------
// Hook – reduced-motion detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the OS / browser signals a preference for reduced motion.
 * Evaluates only once on mount (SSR-safe: defaults to `false`).
 */
function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
    }, []);

    return reduced;
}

// ---------------------------------------------------------------------------
// Hook – carousel auto-advance timer
// ---------------------------------------------------------------------------

interface UseCarouselTimerParams {
    readonly enabled: boolean;
    readonly intervalMs: number;
    readonly advance: () => void;
}

/**
 * Manages the `setInterval` responsible for automatic slide advances.
 * Exposes `pause` and `resume` so the parent can react to hover/focus events.
 * Returns a `reset` function that restarts the timer from zero (used when the
 * user manually selects a dot indicator).
 */
function useCarouselTimer({ enabled, intervalMs, advance }: UseCarouselTimerParams): {
    pause: () => void;
    resume: () => void;
    reset: () => void;
} {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pausedRef = useRef(false);

    const stop = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        if (!enabled || pausedRef.current) return;
        stop();
        timerRef.current = setInterval(advance, intervalMs);
    }, [enabled, intervalMs, advance, stop]);

    // Start / stop when `enabled` or `intervalMs` changes.
    useEffect(() => {
        start();
        return stop;
    }, [start, stop]);

    const pause = useCallback(() => {
        pausedRef.current = true;
        stop();
    }, [stop]);

    const resume = useCallback(() => {
        pausedRef.current = false;
        start();
    }, [start]);

    const reset = useCallback(() => {
        stop();
        if (enabled && !pausedRef.current) {
            timerRef.current = setInterval(advance, intervalMs);
        }
    }, [enabled, intervalMs, advance, stop]);

    return { pause, resume, reset };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * HeroCarousel – full-bleed image carousel designed to be placed as the
 * background layer inside `HeroSection` (`absolute inset-0`).
 *
 * Features:
 * - CSS `transition-opacity` crossfade between slides
 * - Configurable auto-advance with pause-on-hover and pause-on-focus
 * - Dot indicator buttons with keyboard accessibility
 * - Reduced-motion support: disables auto-advance and transitions
 * - Skips slides whose images fail to load (`onError`)
 * - Accessible: semantic `<section>`, `aria-live="polite"` announcement region,
 *   dot buttons with `aria-label` and `aria-pressed`
 * - First slide loads eagerly (`loading="eager"`, `fetchpriority="high"`);
 *   subsequent slides load lazily
 * - Fallback gradient when `slides` is empty
 *
 * @param props - {@link HeroCarouselProps}
 * @returns A React element filling the parent's bounding box.
 *
 * @example
 * ```tsx
 * <HeroCarousel
 *   slides={[
 *     { src: '/images/hero-1.jpg', alt: 'Mountain view' },
 *     { src: '/images/hero-2.jpg', alt: 'Riverside at sunset' },
 *   ]}
 *   autoAdvanceMs={5000}
 *   transitionMs={800}
 * />
 * ```
 */
export function HeroCarousel({
    slides,
    labels,
    autoAdvanceMs = 6000,
    transitionMs = 1000
}: HeroCarouselProps): JSX.Element {
    const prefersReducedMotion = useReducedMotion();

    // Tracks which slide indices have failed to load so we can skip them.
    const [failedSlides, setFailedSlides] = useState<ReadonlySet<number>>(new Set());

    // Build the list of valid (non-failed) slide indices.
    const validIndices = slides.map((_, i) => i).filter((i) => !failedSlides.has(i));

    const [currentSlide, setCurrentSlide] = useState(0);

    /**
     * Advance to the next valid slide, wrapping around.
     * Skips any slide whose image has errored.
     */
    const advance = useCallback(() => {
        if (validIndices.length < 2) return;
        setCurrentSlide((prev) => {
            const currentPos = validIndices.indexOf(prev);
            const nextPos = (currentPos + 1) % validIndices.length;
            return validIndices[nextPos] ?? prev;
        });
    }, [validIndices]);

    const autoEnabled = !prefersReducedMotion && validIndices.length > 1;
    const effectiveTransitionMs = prefersReducedMotion ? 0 : transitionMs;

    const { pause, resume, reset } = useCarouselTimer({
        enabled: autoEnabled,
        intervalMs: autoAdvanceMs,
        advance
    });

    // Track focus inside the carousel region to pause auto-advance.
    const regionRef = useRef<HTMLElement>(null);

    /**
     * Handles `focusin` events on the carousel region – pauses auto-advance.
     */
    const handleFocusIn = useCallback(() => {
        pause();
    }, [pause]);

    /**
     * Handles `focusout` events on the carousel region – resumes auto-advance
     * when focus leaves entirely (not just moves between children).
     */
    const handleFocusOut = useCallback(
        (event: FocusEvent) => {
            const region = regionRef.current;
            if (region && !region.contains(event.relatedTarget as Node | null)) {
                resume();
            }
        },
        [resume]
    );

    useEffect(() => {
        const el = regionRef.current;
        if (!el) return;
        el.addEventListener('focusin', handleFocusIn);
        el.addEventListener('focusout', handleFocusOut);
        return () => {
            el.removeEventListener('focusin', handleFocusIn);
            el.removeEventListener('focusout', handleFocusOut);
        };
    }, [handleFocusIn, handleFocusOut]);

    // Keep currentSlide pointing at a valid index if the failed set changes.
    useEffect(() => {
        if (failedSlides.has(currentSlide) && validIndices.length > 0) {
            setCurrentSlide(validIndices[0] ?? 0);
        }
    }, [failedSlides, currentSlide, validIndices]);

    /**
     * Marks a slide image as failed and triggers a skip to the next valid one.
     */
    const handleImageError = useCallback((index: number) => {
        setFailedSlides((prev) => new Set([...prev, index]));
    }, []);

    /**
     * Handles a dot indicator click: navigates to the given slide and resets
     * the auto-advance timer so the user has a full interval before the next
     * automatic transition.
     */
    const handleDotClick = useCallback(
        (targetIndex: number) => {
            setCurrentSlide(targetIndex);
            reset();
        },
        [reset]
    );

    // ---------------------------------------------------------------------------
    // Fallback: empty slides
    // ---------------------------------------------------------------------------

    if (slides.length === 0 || validIndices.length === 0) {
        return (
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-primary to-primary-dark"
            />
        );
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const transitionStyle = { transitionDuration: `${effectiveTransitionMs}ms` } as const;

    /** Keyboard navigation for the carousel region */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const currentPos = validIndices.indexOf(currentSlide);
                const prevPos = (currentPos - 1 + validIndices.length) % validIndices.length;
                handleDotClick(validIndices[prevPos] ?? 0);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleDotClick(
                    validIndices[(validIndices.indexOf(currentSlide) + 1) % validIndices.length] ??
                        0
                );
            }
        },
        [validIndices, currentSlide, handleDotClick]
    );

    return (
        <section
            ref={regionRef}
            aria-label={labels.carouselAriaLabel}
            aria-roledescription="carousel"
            className="absolute inset-0"
            onMouseEnter={pause}
            onMouseLeave={resume}
            onKeyDown={handleKeyDown}
            data-testid="hero-carousel"
        >
            {/* ----------------------------------------------------------------
                Slide images – stacked via `absolute inset-0`, opacity toggled
            ----------------------------------------------------------------- */}
            {slides.map((slide, index) => {
                const isActive = index === currentSlide && !failedSlides.has(index);
                const isFailed = failedSlides.has(index);

                if (isFailed) return null;

                return (
                    <img
                        key={slide.src}
                        src={slide.src}
                        alt={slide.alt}
                        className={[
                            'absolute inset-0 h-full w-full object-cover transition-opacity',
                            isActive ? 'animate-ken-burns opacity-100' : 'opacity-0'
                        ].join(' ')}
                        style={transitionStyle}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : undefined}
                        onError={() => handleImageError(index)}
                        aria-hidden={!isActive}
                        data-testid={`slide-${index}`}
                    />
                );
            })}

            {/* ----------------------------------------------------------------
                Live region – announces the current slide to screen readers
            ----------------------------------------------------------------- */}
            <div
                aria-atomic="true"
                aria-live="polite"
                className="sr-only"
                data-testid="aria-live-region"
            >
                {slides[currentSlide]
                    ? labels.liveRegionText
                          .replace('{current}', String(validIndices.indexOf(currentSlide) + 1))
                          .replace('{total}', String(validIndices.length))
                          .replace('{alt}', slides[currentSlide].alt)
                    : ''}
            </div>

            {/* ----------------------------------------------------------------
                Dot indicators – only rendered when there are multiple slides
            ----------------------------------------------------------------- */}
            {validIndices.length > 1 && (
                <fieldset
                    className="-translate-x-1/2 absolute bottom-16 left-1/2 z-10 flex gap-2 border-0 p-0"
                    data-testid="dot-indicators"
                >
                    <legend className="sr-only">{labels.slideNavLegend}</legend>

                    {validIndices.map((slideIndex, pos) => {
                        const isActiveDot = slideIndex === currentSlide;
                        return (
                            <button
                                key={slideIndex}
                                type="button"
                                onClick={() => handleDotClick(slideIndex)}
                                aria-label={labels.dotAriaLabel
                                    .replace('{current}', String(pos + 1))
                                    .replace('{total}', String(validIndices.length))}
                                aria-pressed={isActiveDot}
                                className={[
                                    'h-2.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2',
                                    isActiveDot
                                        ? 'w-6 bg-white shadow-md'
                                        : 'w-2.5 border border-white/60 bg-white/30 hover:bg-white/60'
                                ].join(' ')}
                                data-testid={`dot-${slideIndex}`}
                            />
                        );
                    })}
                </fieldset>
            )}
        </section>
    );
}
