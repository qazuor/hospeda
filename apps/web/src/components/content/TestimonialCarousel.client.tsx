/**
 * Testimonials carousel React island with auto-advance, pause on hover,
 * prev/next navigation, dot indicators, touch swipe support, and full ARIA.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/** Extract up to 2 initials from a full name. */
function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

interface TestimonialItem {
    id: string;
    quote: string;
    author: string;
    image?: string;
    location?: string;
    rating?: number;
}

interface TestimonialCarouselProps {
    testimonials: TestimonialItem[];
    autoAdvanceMs?: number;
    locale?: SupportedLocale;
}

export const TestimonialCarousel = ({
    testimonials,
    autoAdvanceMs = 5000,
    locale = 'es'
}: TestimonialCarouselProps) => {
    const { t } = useTranslation({ locale, namespace: 'home' });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
    const touchStartX = useRef(0);

    /** Mark an image as failed so we show the initials fallback instead. */
    const handleImageError = useCallback((id: string) => {
        setFailedImages((prev) => new Set(prev).add(id));
    }, []);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, [testimonials.length]);

    const goToPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    }, [testimonials.length]);

    /** Auto-advance interval */
    useEffect(() => {
        if (isPaused || testimonials.length <= 1) return;

        const interval = setInterval(goToNext, autoAdvanceMs);
        return () => clearInterval(interval);
    }, [isPaused, goToNext, autoAdvanceMs, testimonials.length]);

    /** Touch swipe handlers */
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0]?.clientX ?? 0;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0]?.clientX ?? 0;
        const delta = touchStartX.current - touchEndX;
        const swipeThreshold = 50;

        if (Math.abs(delta) > swipeThreshold) {
            if (delta > 0) {
                goToNext();
            } else {
                goToPrev();
            }
        }
    };

    /** Render stars for rating */
    const starPositions = [1, 2, 3, 4, 5] as const;
    const renderStars = (rating: number) => {
        const safeRating = Math.min(5, Math.max(1, Math.round(rating)));
        return (
            <div
                className="mt-1 flex gap-0.5"
                aria-label={t('testimonials.starsAriaLabel', `${safeRating} de 5 estrellas`, {
                    rating: safeRating
                })}
            >
                {starPositions.map((position) => (
                    <span
                        key={position}
                        className={position <= safeRating ? 'text-star' : 'text-star-empty'}
                        aria-hidden="true"
                    >
                        {position <= safeRating ? '\u2605' : '\u2606'}
                    </span>
                ))}
            </div>
        );
    };

    /** Keyboard navigation */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPrev();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToNext();
        }
    };

    if (testimonials.length === 0) return null;

    return (
        <section
            aria-roledescription="carousel"
            aria-label={t('testimonials.regionAriaLabel', 'Testimonios de usuarios')}
            className="relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Carousel track */}
            <div
                className="overflow-hidden"
                aria-live="off"
            >
                <div
                    className="flex transition-transform duration-300 ease-in-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {testimonials.map((testimonial) => (
                        <div
                            key={testimonial.id}
                            className="w-full flex-shrink-0 px-2 sm:w-1/2 lg:w-1/3"
                        >
                            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                                <div
                                    className="mb-4 text-4xl text-primary/20"
                                    aria-hidden="true"
                                >
                                    &ldquo;
                                </div>
                                <blockquote className="mb-4">
                                    <p className="text-text italic">{testimonial.quote}</p>
                                </blockquote>
                                <div className="flex items-center gap-3">
                                    {testimonial.image && !failedImages.has(testimonial.id) ? (
                                        <img
                                            src={testimonial.image}
                                            alt={`${testimonial.author} avatar`}
                                            className="h-14 w-14 rounded-full object-cover ring-2 ring-white dark:ring-gray-700"
                                            loading="lazy"
                                            onError={() => handleImageError(testimonial.id)}
                                        />
                                    ) : (
                                        <span
                                            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 font-semibold text-lg text-primary ring-2 ring-white dark:ring-gray-700"
                                            aria-hidden="true"
                                        >
                                            {getInitials(testimonial.author)}
                                        </span>
                                    )}
                                    <div>
                                        <div className="font-semibold text-text">
                                            {testimonial.author}
                                        </div>
                                        {testimonial.rating && renderStars(testimonial.rating)}
                                        {testimonial.location && (
                                            <div className="text-sm text-text-tertiary">
                                                {testimonial.location}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation arrows */}
            {testimonials.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={goToPrev}
                        className="-left-4 -translate-y-1/2 absolute top-1/2 rounded-full bg-surface p-2 shadow-md transition-colors hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        aria-label={t('testimonials.prevAriaLabel', 'Testimonial anterior')}
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={goToNext}
                        className="-right-4 -translate-y-1/2 absolute top-1/2 rounded-full bg-surface p-2 shadow-md transition-colors hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        aria-label={t('testimonials.nextAriaLabel', 'Siguiente testimonial')}
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                </>
            )}

            {/* Dot indicators */}
            {testimonials.length > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                    {testimonials.map((testimonial, idx) => (
                        <button
                            key={testimonial.id}
                            type="button"
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-2.5 w-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                idx === currentIndex ? 'bg-primary' : 'bg-border'
                            }`}
                            aria-label={t(
                                'testimonials.dotAriaLabel',
                                `Ir a testimonial ${idx + 1}`,
                                { index: idx + 1 }
                            )}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};
