/**
 * Animated counter row that counts up when entering the viewport.
 * Displays multiple counters inline with dividers.
 * Used by LiveStatsCounter in the hero section.
 */
import type { JSX } from 'react';
import { useCountUp, useViewportTrigger } from '../../hooks/useCountUp';

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
// Component
// ---------------------------------------------------------------------------

/**
 * Animated counter row that counts up when entering the viewport.
 * Uses shared useCountUp hook with IntersectionObserver trigger.
 */
export function AnimatedCounter({ items, className }: AnimatedCounterProps): JSX.Element {
    const [containerRef, isVisible] = useViewportTrigger<HTMLDivElement>();

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
    const { value } = useCountUp({ target: item.value, isVisible });

    return (
        <span className="flex items-center gap-1 text-sm text-white/70">
            <span className="font-bold text-white tabular-nums">
                {value}
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
