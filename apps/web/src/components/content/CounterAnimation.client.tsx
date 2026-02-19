/**
 * IntersectionObserver-based count-up animation React island.
 * Animates a number from 0 to targetValue when the element enters the viewport.
 * Respects prefers-reduced-motion by showing final value immediately.
 * Fires only once per page load via hasAnimated ref.
 */
import { useEffect, useRef, useState } from 'react';

interface CounterAnimationProps {
    /** Target number to animate to */
    targetValue: number;
    /** Text displayed after the number (e.g., '+') */
    suffix?: string;
    /** Text displayed before the number */
    prefix?: string;
    /** Descriptive label shown below the number */
    label: string;
}

/**
 * Easing function for smooth deceleration at the end of the animation.
 */
const easeOutQuart = (t: number): number => 1 - (1 - t) ** 4;

export const CounterAnimation = ({
    targetValue,
    suffix = '',
    prefix = '',
    label
}: CounterAnimationProps) => {
    const [displayValue, setDisplayValue] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        /** Check if user prefers reduced motion */
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            setDisplayValue(targetValue);
            setIsComplete(true);
            hasAnimated.current = true;
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const duration = 2000;
                    const startTime = performance.now();

                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const easedProgress = easeOutQuart(progress);
                        const currentValue = Math.round(easedProgress * targetValue);

                        setDisplayValue(currentValue);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            setDisplayValue(targetValue);
                            setIsComplete(true);
                        }
                    };

                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [targetValue]);

    const formattedValue = displayValue.toLocaleString('es-AR');

    return (
        <div
            ref={elementRef}
            className="flex flex-col items-center text-center"
        >
            <div className="font-bold text-[length:var(--fs-counter-number)] text-white">
                <span aria-hidden={isComplete ? undefined : 'true'}>
                    {prefix}
                    {formattedValue}
                    {suffix}
                </span>
            </div>
            <span
                aria-live="polite"
                className="sr-only"
            >
                {isComplete
                    ? `${prefix}${targetValue.toLocaleString('es-AR')}${suffix} ${label}`
                    : ''}
            </span>
            <div className="mt-2 font-medium text-sm text-white/80 uppercase tracking-wider">
                {label}
            </div>
        </div>
    );
};
