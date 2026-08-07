/**
 * @file HeroImageRotator.client.tsx
 * @description React island that cycles through hero background images using
 * pure CSS opacity transitions. All images are stacked and only the active
 * image is visible at any given time, producing a smooth crossfade effect.
 *
 * Accessibility: the container uses role="img" with aria-label derived from
 * the active image alt text. Individual images use aria-hidden="true" to
 * avoid redundant announcements from assistive technologies. aria-live="polite"
 * announces image transitions to screen readers.
 *
 * Tasks: T-064
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import styles from './HeroImageRotator.module.css';

/** A single image entry for the rotator. */
interface HeroImage {
    readonly src: string;
    readonly alt: string;
    /**
     * Optional srcset string for responsive image selection. When provided,
     * the browser picks the best matching width from the candidates.
     */
    readonly srcset?: string;
    /**
     * Optional `sizes` attribute paired with `srcset` so the browser knows
     * the rendered image width per viewport.
     */
    readonly sizes?: string;
}

interface HeroImageRotatorProps {
    /** Array of images to rotate through. At least one image is required. */
    readonly images: readonly HeroImage[];
    /**
     * Time in milliseconds between image transitions.
     * @default 5000
     */
    readonly interval?: number;
}

/**
 * Hero image rotator island.
 *
 * Stacks all provided images on top of each other (position absolute, inset 0)
 * and cross-fades between them at the given interval using CSS opacity
 * transitions. No carousel library. Cleans up the interval on unmount.
 *
 * @example
 * ```tsx
 * <HeroImageRotator
 *   images={[
 *     { src: '/images/hero-1.jpg', alt: 'Vista del rio' },
 *     { src: '/images/hero-2.jpg', alt: 'Alojamiento colonial' },
 *   ]}
 *   interval={6000}
 *   client:load
 * />
 * ```
 */
export function HeroImageRotator({ images, interval = 5000 }: HeroImageRotatorProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [started, setStarted] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reducedMotion = useReducedMotion();

    // Gate the rotation on the first user interaction (HOS-369).
    //
    // Each crossfade paints a DIFFERENT <img> element, and the LCP algorithm
    // records a candidate for every newly painted element. That is fatal here
    // because `.hero__visual` is sized off its parent (`top: 0; bottom: 320px`
    // on mobile), and the parent grows once `.hero__bottom` finishes streaming
    // in: the hero is 466 px tall at first paint and 624 px 180 ms later. LCP
    // freezes an element's size at ITS first paint, so image 0 stays recorded
    // at 191,992 px² forever, while an image first painted after the layout
    // settles measures 256,882 px² — larger, so it becomes the new LCP.
    //
    // Measured on staging (mobile, 4x CPU, Slow 4G): LCP 9,294 ms with the
    // rotator running, 1,032 ms with it frozen. Same build, same conditions.
    //
    // The listeners below are exactly the input events that CLOSE the LCP in
    // Chrome. That is what makes this deterministic rather than a race: after
    // an interaction the metric is sealed, so crossfading is harmless; without
    // one (Lighthouse, PSI, crawlers) nothing rotates and the LCP stays clean.
    // A fixed timeout would NOT work — Lighthouse observes until the network
    // goes quiet, so any delay we pick is a race we can lose.
    //
    // Known trade-off, deliberately accepted: a visitor who never interacts
    // stays on the first image. Removing this gate is tracked as the follow-up
    // that fixes the real cause (the hero growing after first paint).
    useEffect(() => {
        if (reducedMotion) return;
        if (images.length <= 1) return;
        if (started) return;

        const start = () => setStarted(true);
        const opts = { once: true, passive: true } as const;
        window.addEventListener('pointerdown', start, opts);
        window.addEventListener('keydown', start, opts);
        window.addEventListener('touchstart', start, opts);

        return () => {
            window.removeEventListener('pointerdown', start);
            window.removeEventListener('keydown', start);
            window.removeEventListener('touchstart', start);
        };
    }, [images.length, reducedMotion, started]);

    useEffect(() => {
        // Respect prefers-reduced-motion: freeze on the first image.
        if (reducedMotion) return;
        if (images.length <= 1) return;
        if (!started) return;

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % images.length);
        }, interval);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [images.length, interval, reducedMotion, started]);

    const activeAlt = images[activeIndex]?.alt ?? '';

    // Defer the off-screen images' network fetch to the same first interaction
    // that opens the rotation gate above (HOS-369).
    //
    // `loading="lazy"` does NOT achieve this, which is the trap this replaces.
    // The browser's lazy loading triggers on intersection with the VIEWPORT,
    // and these images are stacked on top of the visible one at `opacity: 0` —
    // invisible, but squarely inside the viewport, so they are fetched right
    // away. Measured cold on staging (mobile, 4x CPU, Slow 4G): `hero-atardecer`
    // (94 KB) and `hero-isla` (64 KB) both started at ~2,791 ms and competed for
    // bandwidth with the LCP image itself (48 KB), which took 5,001 ms to
    // arrive. LCP came out at 5,518 ms against a 2,500 ms budget.
    //
    // Omitting `srcSet` as well as `src` is load-bearing: a bare `srcset` is
    // enough for the browser to fetch the image, so gating `src` alone would
    // change nothing. Both are restored together when the gate opens, which
    // leaves a full `interval` (5 s by default) before the first crossfade
    // needs them.
    //
    // Under `prefers-reduced-motion` the gate never opens, so these images are
    // never fetched at all — correct, since nothing will ever rotate to them.
    const shouldFetch = (index: number) => index === 0 || started;

    return (
        <div
            className={styles.container}
            role="img"
            aria-label={activeAlt}
            aria-live="polite"
            aria-atomic="true"
        >
            {images.map((image, index) => (
                <img
                    key={image.src}
                    src={shouldFetch(index) ? image.src : undefined}
                    srcSet={shouldFetch(index) ? image.srcset : undefined}
                    sizes={image.sizes}
                    alt=""
                    aria-hidden="true"
                    className={styles.image}
                    style={{
                        opacity: index === activeIndex ? 1 : 0,
                        transition: reducedMotion ? 'none' : 'opacity 1.5s ease-in-out'
                    }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    // The first image is fetched at high priority so the browser
                    // gets it before non-critical resources; the rest stay at
                    // default.
                    //
                    // It is NOT, however, the only LCP candidate — that claim
                    // stood here and was wrong. Every rotated image paints a new
                    // element and produces its own candidate, which is why the
                    // rotation is gated on first interaction above (HOS-369).
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    width="480"
                    height="540"
                />
            ))}
        </div>
    );
}
