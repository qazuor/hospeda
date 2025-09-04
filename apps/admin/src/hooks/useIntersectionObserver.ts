import { useEffect, useRef, useState } from 'react';

/**
 * Configuration options for useIntersectionObserver
 */
export interface UseIntersectionObserverOptions {
    /** Root element for intersection observation (null = viewport) */
    root?: Element | null;
    /** Root margin for intersection calculation */
    rootMargin?: string;
    /** Threshold for intersection trigger (0-1) */
    threshold?: number | number[];
    /** Whether to trigger only once */
    triggerOnce?: boolean;
    /** Whether to start observing immediately */
    enabled?: boolean;
}

/**
 * Hook for observing element intersection with viewport or root element
 * Useful for lazy loading and performance optimizations
 *
 * @param options - Configuration options
 * @returns Object with ref, isIntersecting state, and entry
 *
 * @example
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver({
 *   threshold: 0.1,
 *   triggerOnce: true
 * });
 *
 * return (
 *   <div ref={ref}>
 *     {isIntersecting && <ExpensiveComponent />}
 *   </div>
 * );
 * ```
 */
export const useIntersectionObserver = (options: UseIntersectionObserverOptions = {}) => {
    const {
        root = null,
        rootMargin = '50px',
        threshold = 0.1,
        triggerOnce = false,
        enabled = true
    } = options;

    const [isIntersecting, setIsIntersecting] = useState(false);
    const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (!enabled || !elementRef.current) return;

        // Create observer
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                setEntry(entry);
                setIsIntersecting(entry.isIntersecting);

                // If triggerOnce and intersecting, disconnect observer
                if (triggerOnce && entry.isIntersecting) {
                    observer.disconnect();
                }
            },
            {
                root,
                rootMargin,
                threshold
            }
        );

        observerRef.current = observer;
        observer.observe(elementRef.current);

        return () => {
            observer.disconnect();
        };
    }, [root, rootMargin, threshold, triggerOnce, enabled]);

    return {
        ref: elementRef,
        isIntersecting,
        entry
    };
};
