/**
 * Minimal image carousel using CSS scroll-snap.
 * Touch swipe works natively via scroll. No external dependencies.
 * Used inside AccommodationCardDetailed as a React island with client:visible.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

interface ImageCarouselProps {
    readonly images: readonly string[];
    readonly alt: string;
    readonly slug: string;
    /** Maximum number of images to render (rest are skipped for perf) */
    readonly maxImages?: number;
    /** Locale for accessibility label translations */
    readonly locale?: SupportedLocale;
}

/** Image carousel with CSS scroll-snap and dot indicators */
export function ImageCarousel({
    images,
    alt,
    slug,
    maxImages = 5,
    locale = 'es'
}: ImageCarouselProps) {
    const { t } = useTranslation({ locale, namespace: 'ui' });
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const visibleImages = images.slice(0, maxImages);
    const count = visibleImages.length;

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const index = Math.round(el.scrollLeft / el.offsetWidth);
        setActiveIndex(index);
    }, []);

    const goTo = useCallback((index: number) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ left: index * el.offsetWidth, behavior: 'smooth' });
        setActiveIndex(index);
    }, []);

    const goNext = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (activeIndex < count - 1) goTo(activeIndex + 1);
        },
        [activeIndex, count, goTo]
    );

    const goPrev = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (activeIndex > 0) goTo(activeIndex - 1);
        },
        [activeIndex, goTo]
    );

    if (count === 0) {
        return (
            <div className="aspect-[4/3] w-full bg-gray-200">
                <img
                    src="/images/placeholder-accommodation.svg"
                    alt={alt}
                    className="h-full w-full object-cover"
                    style={{ viewTransitionName: `entity-${slug}` }}
                />
            </div>
        );
    }

    if (count === 1) {
        return (
            <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                    src={visibleImages[0]}
                    alt={alt}
                    className="h-full w-full object-cover"
                    loading="eager"
                    style={{ viewTransitionName: `entity-${slug}` }}
                />
            </div>
        );
    }

    return (
        <div className="group/carousel relative aspect-[4/3] w-full overflow-hidden">
            {/* Scrollable container */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {visibleImages.map((src, i) => (
                    <div
                        key={src}
                        className="h-full w-full flex-shrink-0 snap-center"
                    >
                        <img
                            src={src}
                            alt={`${alt} ${i + 1}`}
                            className="h-full w-full object-cover"
                            loading={i === 0 ? 'eager' : 'lazy'}
                            style={i === 0 ? { viewTransitionName: `entity-${slug}` } : undefined}
                        />
                    </div>
                ))}
            </div>

            {/* Nav arrows (visible on hover) */}
            {activeIndex > 0 && (
                <button
                    type="button"
                    onClick={goPrev}
                    className="-translate-y-1/2 absolute top-1/2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-gray-800 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/carousel:opacity-100"
                    aria-label={t('accessibility.previousImage')}
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M7.5 2L3.5 6L7.5 10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            )}
            {activeIndex < count - 1 && (
                <button
                    type="button"
                    onClick={goNext}
                    className="-translate-y-1/2 absolute top-1/2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-gray-800 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/carousel:opacity-100"
                    aria-label={t('accessibility.nextImage')}
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M4.5 2L8.5 6L4.5 10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            )}

            {/* Dot indicators */}
            <div className="-translate-x-1/2 absolute bottom-2 left-1/2 z-10 flex gap-1">
                {visibleImages.map((img, i) => (
                    <button
                        key={`dot-${img}`}
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            goTo(i);
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                            i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                        }`}
                        aria-label={t('accessibility.goToImage', undefined, { number: i + 1 })}
                    />
                ))}
            </div>
        </div>
    );
}
