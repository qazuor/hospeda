/**
 * Shared hook for viewport-triggered count-up animation.
 * Uses IntersectionObserver to detect visibility and requestAnimationFrame
 * for smooth number animation. Respects prefers-reduced-motion.
 */
import { type RefObject, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

/** Ease-out cubic: fast start, gradual deceleration */
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Ease-out quart: similar but slightly longer deceleration */
const easeOutQuart = (t: number): number => 1 - (1 - t) ** 4;

/** Available easing presets */
export type EasingPreset = 'cubic' | 'quart';

const EASING_MAP: Record<EasingPreset, (t: number) => number> = {
    cubic: easeOutCubic,
    quart: easeOutQuart
} as const;

// ---------------------------------------------------------------------------
// Hook: useViewportTrigger
// ---------------------------------------------------------------------------

/** Options for useViewportTrigger */
interface UseViewportTriggerOptions {
    /** Intersection ratio threshold to trigger visibility (default: 0.3) */
    readonly threshold?: number;
}

/**
 * Fires once when the referenced element enters the viewport using IntersectionObserver.
 * Automatically disconnects the observer after the element becomes visible.
 *
 * @param options - Configuration options for the IntersectionObserver
 * @returns Tuple of [ref, isVisible] where ref must be attached to the target element
 *
 * @example
 * ```tsx
 * const [ref, isVisible] = useViewportTrigger<HTMLDivElement>({ threshold: 0.5 });
 * return <div ref={ref}>{isVisible ? 'Visible!' : 'Hidden'}</div>;
 * ```
 */
export function useViewportTrigger<T extends HTMLElement>({
    threshold = 0.3
}: UseViewportTriggerOptions = {}): [RefObject<T | null>, boolean] {
    const ref = useRef<T>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return [ref, isVisible];
}

// ---------------------------------------------------------------------------
// Hook: useCountUp
// ---------------------------------------------------------------------------

/** Parameters for the useCountUp hook */
interface UseCountUpParams {
    /** Target value to animate to */
    readonly target: number;
    /** Animation duration in milliseconds (default: 1500) */
    readonly duration?: number;
    /** Whether animation should start (typically from useViewportTrigger) */
    readonly isVisible: boolean;
    /** Easing function preset (default: 'cubic') */
    readonly easing?: EasingPreset;
}

/** Return value of useCountUp */
interface UseCountUpResult {
    /** Current animated value */
    readonly value: number;
    /** Whether the animation has completed */
    readonly isComplete: boolean;
}

/**
 * Animates a number from 0 to target when `isVisible` becomes true.
 * Uses requestAnimationFrame for smooth animation.
 * Respects `prefers-reduced-motion` by showing the final value immediately.
 * Only fires once per component mount.
 *
 * @param params - Animation configuration
 * @returns Current animated value and completion flag
 *
 * @example
 * ```tsx
 * const { value, isComplete } = useCountUp({ target: 1000, isVisible, duration: 2000 });
 * ```
 */
export function useCountUp({
    target,
    duration = 1500,
    isVisible,
    easing = 'cubic'
}: UseCountUpParams): UseCountUpResult {
    const [value, setValue] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const hasAnimated = useRef(false);
    const easingFn = EASING_MAP[easing];

    useEffect(() => {
        if (!isVisible || hasAnimated.current) return;
        hasAnimated.current = true;

        // Respect prefers-reduced-motion
        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            setValue(target);
            setIsComplete(true);
            return;
        }

        const startTime = performance.now();

        function step(timestamp: number): void {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const current = Math.round(easingFn(progress) * target);
            setValue(current);

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                setValue(target);
                setIsComplete(true);
            }
        }

        requestAnimationFrame(step);
    }, [target, duration, isVisible, easingFn]);

    return { value: isVisible ? value : 0, isComplete };
}
