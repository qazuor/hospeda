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
import styles from './HeroImageRotator.module.css';

/** A single image entry for the rotator. */
interface HeroImage {
    readonly src: string;
    readonly alt: string;
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

    useEffect(() => {
        if (images.length <= 1) return;

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % images.length);
        }, interval);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [images.length, interval]);

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
                    alt=""
                    aria-hidden="true"
                    className={styles.image}
                    style={{
                        opacity: index === activeIndex ? 1 : 0,
                        transition: 'opacity 1.5s ease-in-out'
                    }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    width="480"
                    height="540"
                />
            ))}
        </div>
    );
}
