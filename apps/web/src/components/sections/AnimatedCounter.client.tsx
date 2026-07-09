/**
 * @file AnimatedCounter.client.tsx
 * @description Animated stat counter island. The SSR / first render always emits
 * the real target `value` as text (so crawlers and LLM fetchers that don't run JS
 * or scroll never see "0"); once hydrated AND scrolled into view, it drops to 0 and
 * counts up to the target via requestAnimationFrame with an easeOutQuart easing —
 * a purely visual enhancement. Supports a counter layout (icon + large number +
 * label) and a compact badge layout.
 *
 * SSR-first principle (HOS-117 US-2): an island's SSR output must emit the final
 * datum; hydration only animates/interacts, it must never be the first place a
 * value appears.
 *
 * Tasks: T-072, HOS-117 T-004
 */

import { toBcp47Locale } from '@repo/i18n/web';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { SupportedLocale } from '@/lib/i18n';
import { resolveStatsIcon } from '@/lib/stats-icons';
import styles from './AnimatedCounter.module.css';

/** Easing function: easeOutQuart. */
function easeOutQuart(t: number): number {
    return 1 - (1 - t) ** 4;
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
    /**
     * Locale used for number formatting (thousands and decimal separators).
     * Converted to BCP 47 internally via `toBcp47Locale`.
     */
    readonly locale: SupportedLocale;
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
    duration = 2000,
    locale
}: AnimatedCounterProps) {
    // Seed with the real `value` so the SSR / first client render emits the final
    // number as text (crawlers and LLM fetchers that don't run JS or scroll see
    // "450+", never "0+"). The count-up is a visual enhancement applied only after
    // hydration, once the element scrolls into view (see the observer below).
    const [displayValue, setDisplayValue] = useState(value);
    const numberFormatter = useMemo(() => new Intl.NumberFormat(toBcp47Locale(locale)), [locale]);
    const formatNumber = (n: number): string => numberFormatter.format(n);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasAnimatedRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting || hasAnimatedRef.current) return;

                hasAnimatedRef.current = true;
                observer.disconnect();

                // Respect prefers-reduced-motion: keep the final value, skip RAF.
                if (reducedMotion) {
                    setDisplayValue(value);
                    return;
                }

                // Now that we are post-hydration and in view, drop to 0 and run the
                // count-up. The SSR HTML already showed `value`, so machines never
                // saw 0; only a real user (JS + scrolled into view) sees the animation.
                setDisplayValue(0);
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
    }, [value, duration, reducedMotion]);

    const formattedValue = formatNumber(displayValue);
    const ariaLabel = `${prefix ?? ''}${formatNumber(value)}${suffix ?? ''} ${label}`;

    if (variant === 'badge') {
        return (
            // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the animated value + label text; a real <fieldset> would inherit user-agent border/padding/margin that fight this badge layout
            <div
                ref={containerRef}
                className={styles.badge}
                role="group"
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
    const IconComponent = icon ? resolveStatsIcon({ iconName: icon }) : undefined;

    return (
        // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups the animated value + icon + label; a real <fieldset> would inherit user-agent border/padding/margin that fight this counter layout
        <div
            ref={containerRef}
            className={styles.counter}
            role="group"
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
