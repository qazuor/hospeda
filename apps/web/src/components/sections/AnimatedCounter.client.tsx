/**
 * @file AnimatedCounter.client.tsx
 * @description Animated stat counter island. Counts up from 0 to the target
 * value when the element scrolls into the viewport, using requestAnimationFrame
 * with an easeOutQuart easing. Supports a counter layout (icon + large number
 * + label) and a compact badge layout.
 *
 * Tasks: T-072
 */

import { resolveIcon } from '@repo/icons';
import { useEffect, useRef, useState } from 'react';
import styles from './AnimatedCounter.module.css';

/** Easing function: easeOutQuart. */
function easeOutQuart(t: number): number {
    return 1 - (1 - t) ** 4;
}

/**
 * Formats a number using the Argentine Spanish locale for proper
 * thousands separator (dot) and decimal separator (comma).
 */
function formatNumber(n: number): string {
    return n.toLocaleString('es-AR');
}

interface AnimatedCounterProps {
    /** Target numeric value to count up to. */
    readonly value: number;
    /** Descriptive label rendered below the number. */
    readonly label: string;
    /**
     * Icon component name from @repo/icons (e.g. "AccommodationIcon").
     * Only used in `counter` variant. Falls back gracefully when unresolved.
     */
    readonly icon?: string;
    /** Optional prefix rendered before the animated number (e.g. "$"). */
    readonly prefix?: string;
    /** Optional suffix rendered after the animated number (e.g. "+"). */
    readonly suffix?: string;
    /**
     * Visual variant.
     * - `counter`: icon circle + large animated number + label (default).
     * - `badge`: compact inline format, e.g. "450+ alojamientos".
     * @default 'counter'
     */
    readonly variant?: 'counter' | 'badge';
    /**
     * Duration of the count-up animation in milliseconds.
     * @default 2000
     */
    readonly duration?: number;
}

/**
 * Animated stat counter island.
 *
 * The count-up animation starts only when the element enters the viewport
 * (IntersectionObserver) and runs exactly once per mount. After the animation
 * completes, the exact `value` is displayed (no interpolation artifact).
 *
 * @example
 * ```tsx
 * // Counter variant with icon
 * <AnimatedCounter
 *   value={450}
 *   label="alojamientos"
 *   icon="AccommodationIcon"
 *   suffix="+"
 *   client:visible
 * />
 *
 * // Badge variant
 * <AnimatedCounter
 *   value={450}
 *   label="alojamientos"
 *   suffix="+"
 *   variant="badge"
 *   client:visible
 * />
 * ```
 */
export function AnimatedCounter({
    value,
    label,
    icon,
    prefix,
    suffix,
    variant = 'counter',
    duration = 2000
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasAnimatedRef = useRef(false);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting || hasAnimatedRef.current) return;

                hasAnimatedRef.current = true;
                observer.disconnect();

                const startTime = performance.now();

                function tick(now: number) {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = easeOutQuart(progress);
                    const current = Math.round(eased * value);

                    setDisplayValue(current);

                    if (progress < 1) {
                        rafRef.current = requestAnimationFrame(tick);
                    } else {
                        // Guarantee exact final value .. no floating point drift
                        setDisplayValue(value);
                    }
                }

                rafRef.current = requestAnimationFrame(tick);
            },
            { threshold: 0.3 }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [value, duration]);

    const formattedValue = formatNumber(displayValue);
    const ariaLabel = `${prefix ?? ''}${formatNumber(value)}${suffix ?? ''} ${label}`;

    if (variant === 'badge') {
        return (
            <div
                ref={containerRef}
                className={styles.badge}
                aria-label={ariaLabel}
            >
                <span className={styles.badgeValue}>
                    {prefix}
                    {formattedValue}
                    {suffix}
                </span>
                <span className={styles.badgeLabel}>{label}</span>
            </div>
        );
    }

    // counter variant
    const IconComponent = icon ? resolveIcon({ iconName: icon }) : undefined;

    return (
        <div
            ref={containerRef}
            className={styles.counter}
            aria-label={ariaLabel}
        >
            {/* Icon circle */}
            {(IconComponent ?? icon) ? (
                <div
                    className={styles.iconCircle}
                    aria-hidden="true"
                >
                    {IconComponent ? (
                        <IconComponent
                            size={32}
                            color="var(--brand-accent)"
                            weight="duotone"
                            aria-hidden="true"
                        />
                    ) : (
                        /* Fallback: show first character of the icon key */
                        <span
                            className={styles.iconFallback}
                            aria-hidden="true"
                        >
                            {icon?.slice(0, 1)}
                        </span>
                    )}
                </div>
            ) : null}

            {/* Animated number */}
            <span
                className={styles.counterValue}
                aria-hidden="true"
            >
                {prefix}
                {formattedValue}
                {suffix}
            </span>

            {/* Label */}
            <span className={styles.counterLabel}>{label}</span>
        </div>
    );
}
