import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CounterItem {
    readonly value: number;
    readonly suffix?: string;
    readonly label: string;
}

interface AnimatedCounterProps {
    readonly items: readonly CounterItem[];
    /** Additional CSS classes for the container */
    readonly className?: string;
}

// ---------------------------------------------------------------------------
// Single counter
// ---------------------------------------------------------------------------

function useCountUp({
    target,
    duration = 1500,
    isVisible
}: {
    readonly target: number;
    readonly duration?: number;
    readonly isVisible: boolean;
}): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!isVisible) return;

        let start = 0;
        const startTime = performance.now();

        function step(timestamp: number): void {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = 1 - (1 - progress) ** 3; // ease-out cubic
            const current = Math.round(eased * target);
            if (current !== start) {
                start = current;
                setCount(current);
            }
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    }, [target, duration, isVisible]);

    return isVisible ? count : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Animated counter row that counts up when entering the viewport.
 * Uses IntersectionObserver to trigger animation.
 */
export function AnimatedCounter({ items, className }: AnimatedCounterProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.3 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 ${className ?? ''}`}
        >
            {items.map((item, index) => (
                <CounterDisplay
                    key={item.label}
                    item={item}
                    isVisible={isVisible}
                    isLast={index === items.length - 1}
                />
            ))}
        </div>
    );
}

function CounterDisplay({
    item,
    isVisible,
    isLast
}: {
    readonly item: CounterItem;
    readonly isVisible: boolean;
    readonly isLast: boolean;
}): JSX.Element {
    const count = useCountUp({ target: item.value, isVisible });

    return (
        <span className="flex items-center gap-1 text-sm text-white/70">
            <span className="font-bold text-white tabular-nums">
                {count}
                {item.suffix ?? ''}
            </span>
            <span>{item.label}</span>
            {!isLast && (
                <span
                    className="ml-4 text-white/30"
                    aria-hidden="true"
                >
                    |
                </span>
            )}
        </span>
    );
}
