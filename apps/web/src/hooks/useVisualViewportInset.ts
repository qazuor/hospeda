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
 * Delays (ms) at which the hook re-reads `visualViewport` after `enabled`
 * flips true, IN ADDITION to the `resize`/`scroll` listeners (HOS-309 /
 * HOS-138 — H-138).
 *
 * ## Why this exists
 *
 * The first `measure()` call below runs before the mobile keyboard has
 * finished animating in: the caller's own autofocus (which is what triggers
 * the keyboard) runs in a LATER effect of the same render, so at the moment
 * this effect fires the keyboard has not opened yet — that part is expected
 * and not a bug. What SHOULD close the gap is the keyboard's own
 * `visualViewport` `resize` event once it finishes settling. A production
 * smoke (Chrome/Android, HOS-138) reproduced ONE case where that did not
 * happen on the very FIRST focus of a fresh page load: the dialog opened
 * with the pre-keyboard measurement baked into its layout and stayed that
 * way — no error, no crash, just a dialog whose title sat above the visible
 * area — and only self-corrected on a SECOND focus (which fired its own
 * `resize` normally). That is consistent with a browser that drops or
 * delays exactly one `visualViewport` event around the very first IME
 * activation on a page, not with anything wrong in the layout math itself
 * (the reflow used to fix it -- a bare re-focus -- proves the numbers were
 * always right once measured).
 *
 * This was reproduced exactly once and is NOT fully characterized (see the
 * module-level caller docs) — there is no real device in this environment to
 * confirm the exact browser mechanism, so the fix is a resilience net rather
 * than a targeted patch for a diagnosed root cause: re-run `measure()` a few
 * more times over the following ~600 ms regardless of whether a `resize`
 * event arrived. Each call is a cheap read + state update that is a no-op if
 * nothing changed, so this costs nothing on the (overwhelmingly common) path
 * where `resize` fires normally — it only matters on the rare turn where it
 * does not.
 */
const SETTLE_REMEASURE_DELAYS_MS: readonly number[] = [100, 300, 600];

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

        // HOS-309 / HOS-138: safety-net remeasures — see
        // `SETTLE_REMEASURE_DELAYS_MS`'s doc for why these exist.
        const settleTimeouts = SETTLE_REMEASURE_DELAYS_MS.map((delay) =>
            window.setTimeout(measure, delay)
        );

        return () => {
            viewport.removeEventListener('resize', measure);
            viewport.removeEventListener('scroll', measure);
            for (const timeoutId of settleTimeouts) {
                window.clearTimeout(timeoutId);
            }
            setInset(NO_INSET);
        };
    }, [enabled]);

    return inset;
}
