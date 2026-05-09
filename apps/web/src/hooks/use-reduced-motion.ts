/**
 * @file use-reduced-motion.ts
 * @description React hook that reads the `prefers-reduced-motion: reduce`
 * media query and subscribes to changes. Used by animated client islands to
 * gate non-essential motion (auto-rotating carousels, animated counters,
 * crossfades) for users who request reduced motion via OS-level settings.
 *
 * SPEC-099 I-8 — accessibility remediation for animated home-page sections.
 */
import { useEffect, useState } from 'react';

/**
 * Returns whether the user has requested reduced motion via OS settings.
 *
 * Subscribes to changes in the `(prefers-reduced-motion: reduce)` media query
 * and updates reactively. Returns `false` on the server and before the effect
 * runs (first paint), which means animations may briefly start on initial
 * mount; consumers that need a stricter guarantee should also gate on
 * a mounted flag.
 *
 * @returns `true` when reduced motion is requested, `false` otherwise.
 */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState<boolean>(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const onChange = (e: MediaQueryListEvent): void => {
            setReduced(e.matches);
        };
        mq.addEventListener('change', onChange);
        return () => {
            mq.removeEventListener('change', onChange);
        };
    }, []);

    return reduced;
}
