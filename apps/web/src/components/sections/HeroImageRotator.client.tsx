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

import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useEffect, useRef, useState } from 'react';
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
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        // Respect prefers-reduced-motion: freeze on the first image.
        if (reducedMotion) return;
        if (images.length <= 1) return;

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % images.length);
        }, interval);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [images.length, interval, reducedMotion]);

    const activeAlt = images[activeIndex]?.alt ?? '';

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
                    src={image.src}
                    srcSet={image.srcset}
                    sizes={image.sizes}
                    alt=""
                    aria-hidden="true"
                    className={styles.image}
                    style={{
                        opacity: index === activeIndex ? 1 : 0,
                        transition: reducedMotion ? 'none' : 'opacity 1.5s ease-in-out'
                    }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    // Only the first hero image is the LCP candidate; mark it
                    // high priority so the browser fetches it before non-critical
                    // resources. Subsequent rotated images stay at default.
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    width="480"
                    height="540"
                />
            ))}
        </div>
    );
}
