/**
 * @file HeroSlideshow.tsx
 * @description Hero background image slideshow with crossfade transitions.
 *
 * Uses two permanent img layers (A and B) that alternate roles.
 * The incoming image is always placed ON TOP at opacity 0, then fades in.
 * The outgoing image stays fully opaque underneath.. no flash, no background visible.
 *
 * All images are preloaded on mount to avoid blank frames.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Single hero image definition */
interface HeroImage {
    readonly src: string;
    readonly alt: string;
}

/** Props for the HeroSlideshow component */
interface HeroSlideshowProps {
    /** Array of images to cycle through */
    readonly images: readonly HeroImage[];
    /** Time in ms each image stays visible before transitioning */
    readonly interval?: number;
    /** Duration of the crossfade transition in ms */
    readonly fadeDuration?: number;
}

const DEFAULT_INTERVAL = 6000;
const DEFAULT_FADE_DURATION = 1200;

/**
 * Hero slideshow component with crossfade transitions.
 *
 * Flow per transition:
 * 1. Current image visible (layer on top, opacity 1)
 * 2. Next image placed on top at opacity 0
 * 3. Next image fades in from 0 to 1
 * 4. Previous image now hidden underneath
 * 5. Repeat cyclically (6 -> 1 works because z-index is dynamic)
 */
function HeroSlideshow({
    images,
    interval = DEFAULT_INTERVAL,
    fadeDuration = DEFAULT_FADE_DURATION
}: HeroSlideshowProps) {
    const [activeSlide, setActiveSlide] = useState(0);
    const [dotsVisible, setDotsVisible] = useState(true);
    const [dotsOpacity, setDotsOpacity] = useState(1);
    const layerARef = useRef<HTMLImageElement>(null);
    const layerBRef = useRef<HTMLImageElement>(null);
    const isTransitioning = useRef(false);
    const aIsOnTop = useRef(true);
    const currentIndex = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Preload all images on mount
    useEffect(() => {
        for (const img of images) {
            const preload = new Image();
            preload.src = img.src;
        }
    }, [images]);

    // Initialize layers
    useEffect(() => {
        const layerA = layerARef.current;
        const layerB = layerBRef.current;
        if (!layerA || !layerB || images.length === 0) return;

        const firstImage = images[0];
        if (!firstImage) return;

        layerA.src = firstImage.src;
        layerA.alt = firstImage.alt;
        layerA.style.opacity = '1';
        layerA.style.zIndex = '2';
        layerA.style.transition = 'none';

        layerB.src = firstImage.src;
        layerB.alt = firstImage.alt;
        layerB.style.opacity = '1';
        layerB.style.zIndex = '1';
        layerB.style.transition = 'none';

        aIsOnTop.current = true;
        currentIndex.current = 0;
    }, [images]);

    const transitionTo = useCallback(
        (nextIndex: number) => {
            if (isTransitioning.current) return;

            const layerA = layerARef.current;
            const layerB = layerBRef.current;
            if (!layerA || !layerB) return;

            const nextImage = images[nextIndex];
            if (!nextImage) return;

            isTransitioning.current = true;
            currentIndex.current = nextIndex;
            setActiveSlide(nextIndex);

            const incoming = aIsOnTop.current ? layerB : layerA;
            const outgoing = aIsOnTop.current ? layerA : layerB;

            // Step 1: place incoming on top at opacity 0, no transition
            incoming.style.transition = 'none';
            incoming.style.opacity = '0';
            incoming.style.zIndex = '3';
            incoming.src = nextImage.src;
            incoming.alt = nextImage.alt;

            outgoing.style.zIndex = '1';

            // Step 2: wait for decode, then fade in
            const startFade = () => {
                // Force reflow so browser registers opacity 0 without transition
                incoming.getBoundingClientRect();

                incoming.style.transition = `opacity ${fadeDuration}ms ease-in-out`;
                incoming.style.opacity = '1';

                setTimeout(() => {
                    incoming.style.zIndex = '2';
                    outgoing.style.zIndex = '1';
                    aIsOnTop.current = !aIsOnTop.current;
                    isTransitioning.current = false;
                }, fadeDuration + 50);
            };

            if (incoming.decode) {
                incoming.decode().then(startFade).catch(startFade);
            } else {
                requestAnimationFrame(startFade);
            }
        },
        [images, fadeDuration]
    );

    /** Restarts the auto-advance timer from scratch */
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (images.length <= 1) return;

        timerRef.current = setInterval(() => {
            const next = (currentIndex.current + 1) % images.length;
            transitionTo(next);
        }, interval);
    }, [images.length, interval, transitionTo]);

    /** Navigate to a specific slide (used by dot controls) */
    const goToSlide = useCallback(
        (index: number) => {
            if (index === currentIndex.current) return;
            transitionTo(index);
            resetTimer();
        },
        [transitionTo, resetTimer]
    );

    // Hide dots when scrolled past the hero
    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            const fadeStart = 0;
            const fadeEnd = 500;
            if (scrollY <= fadeStart) {
                setDotsOpacity(1);
                setDotsVisible(true);
            } else if (scrollY >= fadeEnd) {
                setDotsOpacity(0);
                setDotsVisible(false);
            } else {
                const progress = (scrollY - fadeStart) / (fadeEnd - fadeStart);
                setDotsOpacity(1 - progress);
                setDotsVisible(true);
            }
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-advance
    useEffect(() => {
        resetTimer();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [resetTimer]);

    return (
        <div className="absolute inset-0 h-full">
            {/* Image layers */}
            <div className="absolute inset-0 z-[2]">
                <img
                    ref={layerARef}
                    className="absolute inset-0 h-full w-full scale-110 object-cover"
                    loading="eager"
                    src={images[0]?.src}
                    alt={images[0]?.alt ?? ''}
                    style={{ opacity: 1, zIndex: 2 }}
                />
                <img
                    ref={layerBRef}
                    className="absolute inset-0 h-full w-full scale-110 object-cover"
                    loading="eager"
                    src={images[0]?.src}
                    alt={images[0]?.alt ?? ''}
                    style={{ opacity: 1, zIndex: 1 }}
                />
            </div>

            {/* Dot navigation + image caption (viewport-relative so dots stay visible) */}
            {images.length > 1 && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-screen">
                    <div
                        className={`-translate-x-1/2 pointer-events-auto absolute bottom-[60px] left-1/2 flex flex-col items-center gap-2 ${dotsVisible ? '' : 'pointer-events-none'}`}
                        style={{ opacity: dotsOpacity }}
                    >
                        <div
                            role="tablist"
                            aria-label="Slideshow navigation"
                            className="flex items-center gap-2"
                        >
                            {images.map((image, index) => (
                                <button
                                    key={image.src}
                                    type="button"
                                    role="tab"
                                    aria-selected={index === activeSlide}
                                    aria-label={`Slide ${index + 1} de ${images.length}`}
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        index === activeSlide
                                            ? 'w-6 bg-hero-text'
                                            : 'w-2 bg-hero-surface hover:bg-hero-text-muted'
                                    }`}
                                    onClick={() => goToSlide(index)}
                                />
                            ))}
                        </div>
                        {/* Current image caption */}
                        <p className="hero-text-shadow-sm max-w-xs text-center text-hero-text-muted text-xs italic transition-opacity duration-500">
                            {images[activeSlide]?.alt}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export { HeroSlideshow };
export type { HeroSlideshowProps, HeroImage };
