/**
 * @file use-scroll-into-view-when.ts
 * @description Hook that scrolls an element into view — and focuses it — the
 * moment a flag turns true.
 *
 * Written for the "form replaced by its confirmation" transition. A long lead
 * form leaves the visitor scrolled near its submit button; swapping in a short
 * success panel collapses the page under them, and the browser keeps the old
 * scroll offset, so what they actually end up looking at is the footer. The
 * confirmation they were waiting for is off-screen above.
 *
 * Focus moves along with the scroll because the element that had focus (the
 * submit button) no longer exists after the swap — without this the focus ring
 * falls back to `<body>` and keyboard users restart from the top of the page.
 * The target must therefore be focusable: give it `tabIndex={-1}`.
 */

import { type RefObject, useEffect, useRef } from 'react';

/**
 * Scrolls to (and focuses) the returned ref's element when `active` flips true.
 *
 * Honours `prefers-reduced-motion` by falling back to an instant jump. Both
 * `scrollIntoView` and `matchMedia` are feature-detected: jsdom implements
 * neither, and a test environment must not crash on a purely visual effect.
 *
 * @param params.active - Turns true when the element should be revealed
 * @returns A ref to attach to the element to scroll to
 *
 * @example
 * ```tsx
 * const successRef = useScrollIntoViewWhen<HTMLDivElement>({ active: isSuccess });
 * if (isSuccess) return <div ref={successRef} tabIndex={-1}>Done</div>;
 * ```
 */
export function useScrollIntoViewWhen<T extends HTMLElement>({
    active
}: {
    readonly active: boolean;
}): RefObject<T | null> {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        if (!active) {
            return;
        }

        const node = ref.current;
        if (!node) {
            return;
        }

        const prefersReducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        }

        // `preventScroll` so focusing does not fight the smooth scroll above.
        node.focus({ preventScroll: true });
    }, [active]);

    return ref;
}
