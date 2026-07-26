/**
 * @file useVisualViewportInset.ts
 * @description Tracks the part of the screen the user can actually see, so a
 * fixed-position surface can stay clear of the mobile virtual keyboard
 * (HOS-309).
 *
 * @module hooks/useVisualViewportInset
 */

import { useEffect, useState } from 'react';

export interface VisualViewportInset {
    /** Height of the visible area in px, or `null` when it cannot be measured. */
    readonly height: number | null;
    /**
     * Distance in px between the bottom of the layout viewport and the bottom
     * of the visible area — i.e. how tall the keyboard is, from the point of
     * view of a `position: fixed` element anchored with `bottom`.
     */
    readonly bottomInset: number;
}

const NO_INSET: VisualViewportInset = { height: null, bottomInset: 0 };

/**
 * Reports the visible viewport while `enabled`.
 *
 * `100vh` is the wrong unit for anything that has to survive a keyboard: it
 * measures the layout viewport, which does not shrink when the keyboard opens.
 * `100dvh` is better but still keyboard-blind on iOS Safari, where the layout
 * viewport stays put and only `visualViewport` moves. Reading `visualViewport`
 * directly is the only measurement that holds on both platforms.
 *
 * Returns zeroes when the API is missing (older browsers, jsdom), so callers
 * can fall back to `dvh` in CSS without branching.
 *
 * @example
 * ```tsx
 * const { height, bottomInset } = useVisualViewportInset({ enabled: isOpen });
 * ```
 */
export function useVisualViewportInset({
    enabled
}: {
    readonly enabled: boolean;
}): VisualViewportInset {
    const [inset, setInset] = useState<VisualViewportInset>(NO_INSET);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        const measure = (): void => {
            // `offsetTop` matters on iOS: the visual viewport can be scrolled
            // within the layout viewport, so the gap at the bottom is what is
            // left over after both the visible area and that offset.
            const bottomInset = Math.max(
                0,
                Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
            );
            setInset({ height: Math.round(viewport.height), bottomInset });
        };

        measure();
        viewport.addEventListener('resize', measure);
        viewport.addEventListener('scroll', measure);
        return () => {
            viewport.removeEventListener('resize', measure);
            viewport.removeEventListener('scroll', measure);
            setInset(NO_INSET);
        };
    }, [enabled]);

    return inset;
}
