import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { HeroImageCarousel } from './HeroImageCarousel.client';
import { RotatingPhrase } from './RotatingPhrase.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeroCarouselWithPhrasesProps {
    readonly images: readonly string[];
    readonly phrases: readonly string[];
    readonly interval?: number;
    readonly enableParallax?: boolean;
    readonly ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Wraps the HeroImageCarousel and RotatingPhrase so they share the
 * current slide index (required because Astro islands cannot share state).
 *
 * The carousel renders absolutely inside its parent.
 * The rotating phrase is placed at the bottom of the hero content area
 * via a slot-like mechanism in HeroSection.astro.
 */
export function HeroCarouselWithPhrases({
    images,
    phrases,
    interval = 6000,
    enableParallax = false,
    ariaLabel = 'Hero image carousel'
}: HeroCarouselWithPhrasesProps): JSX.Element {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleSlideChange = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    return (
        <>
            <HeroImageCarousel
                images={images}
                interval={interval}
                enableParallax={enableParallax}
                ariaLabel={ariaLabel}
                onSlideChange={handleSlideChange}
            />
            {/* Rotating phrase portal: rendered absolute in the hero content area */}
            <div className="hero-rotating-phrase pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-44 sm:pb-48">
                <div className="pointer-events-auto mx-auto max-w-lg text-center">
                    <RotatingPhrase
                        phrases={phrases}
                        currentIndex={currentIndex}
                    />
                </div>
            </div>
        </>
    );
}
