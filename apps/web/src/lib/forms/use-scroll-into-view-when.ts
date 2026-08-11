/**
 * @file use-scroll-into-view-when.ts
 * @description Brings an element into view and moves focus to it when a
 * condition becomes true.
 *
 * Built for the case where a short panel REPLACES a tall one — a submitted form
 * swapped for its confirmation. The new panel renders at the top of the region
 * the form occupied, which is above the visitor's scroll offset, so they are
 * left looking at whatever follows (usually the footer) with no sign that
 * anything happened.
 *
 * Focus moves for a second, independent reason: the element that held focus was
 * the submit button, and it no longer exists. Focus therefore falls back to
 * `<body>`, which strands keyboard and screen-reader users at the top of the
 * document. Scrolling alone fixes the sighted case and leaves that one broken.
 *
 * @module lib/forms/use-scroll-into-view-when
 */

import { type RefObject, useEffect, useRef } from 'react';

interface UseScrollIntoViewWhenInput {
    /**
     * Whether the target should be revealed. The effect runs on the TRANSITION
     * into `true`, not on every render while it stays true — otherwise an
     * unrelated re-render would yank the page back to the panel.
     */
    readonly active: boolean;
}

interface UseScrollIntoViewWhenResult<T extends HTMLElement> {
    /** Attach to the element that should be revealed. */
    readonly ref: RefObject<T | null>;
}

/**
 * Reveals and focuses the ref'd element when `active` turns true.
 *
 * Generic in the element type so callers attach the ref to a concrete tag
 * without a cast — `SPEC-039` requires every cast in production source to carry
 * a justification comment, and "React wanted a narrower ref" is not a reason
 * worth writing down when the signature can just say it.
 *
 * @param input - `{ active }` — the condition to watch.
 * @returns `{ ref }` to attach to the element that should be revealed.
 */
export function useScrollIntoViewWhen<T extends HTMLElement = HTMLElement>({
    active
}: UseScrollIntoViewWhenInput): UseScrollIntoViewWhenResult<T> {
    const ref = useRef<T | null>(null);

    // The dependency array IS the once-per-transition guard: the effect re-runs
    // only when `active` changes, so a re-render while the panel is already on
    // screen cannot yank the page back to it. An explicit `wasActive` ref was
    // written here first and then removed — a mutation that deleted it left every
    // test green, which is the correct verdict on redundant code rather than a
    // missing test.
    useEffect(() => {
        if (!active) return;

        const element = ref.current;
        if (!element) return;

        // `matchMedia` is absent in some SSR/test environments; treating that as
        // "no preference" keeps the animated path as the default.
        const prefersReducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Guarded because jsdom does not implement `scrollIntoView` at all, and
        // the guard is load-bearing rather than a test convenience: without it
        // this hook throws inside an effect and takes the whole island down with
        // it. Focus still moves below — that half is the accessible one, and it
        // must not be lost just because the viewport cannot be moved.
        if (typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        }

        // A container like a `<div>` is not focusable on its own. Setting this
        // programmatically rather than in the JSX keeps the concern with the
        // behaviour that needs it — a caller who forgets the attribute would
        // otherwise get silent focus loss rather than a visible bug.
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '-1');
        }
        element.focus();
    }, [active]);

    return { ref };
}
