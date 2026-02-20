/**
 * Client-side counter that fetches real stats from the API.
 * Loads destination and accommodation counts from public endpoints,
 * then displays them with count-up animation via AnimatedCounter.
 */
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { AnimatedCounter } from './AnimatedCounter.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CounterItem {
    readonly value: number;
    readonly suffix?: string;
    readonly label: string;
}

interface StatsLabels {
    readonly destinations: string;
    readonly accommodations: string;
}

interface LiveStatsCounterProps {
    readonly apiBaseUrl: string;
    readonly labels: StatsLabels;
    /** Fallback items to show while loading or if fetch fails */
    readonly fallbackItems: readonly CounterItem[];
    /** Additional CSS classes passed to AnimatedCounter */
    readonly className?: string;
}

interface PaginatedResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: readonly unknown[];
        readonly pagination: { readonly total: number };
    };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchTotal({
    apiBaseUrl,
    endpoint
}: {
    readonly apiBaseUrl: string;
    readonly endpoint: string;
}): Promise<number | null> {
    try {
        const response = await fetch(`${apiBaseUrl}${endpoint}?pageSize=1`);
        if (!response.ok) return null;
        const json = (await response.json()) as PaginatedResponse;
        return json?.data?.pagination?.total ?? null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Fetches real stats from the API and displays them with animated counters.
 * Falls back to provided static values if API is unavailable.
 */
export function LiveStatsCounter({
    apiBaseUrl,
    labels,
    fallbackItems,
    className
}: LiveStatsCounterProps): JSX.Element {
    const [items, setItems] = useState<readonly CounterItem[]>(fallbackItems);

    useEffect(() => {
        let cancelled = false;

        async function loadStats(): Promise<void> {
            const [destinationsTotal, accommodationsTotal] = await Promise.all([
                fetchTotal({ apiBaseUrl, endpoint: '/api/v1/public/destinations' }),
                fetchTotal({ apiBaseUrl, endpoint: '/api/v1/public/accommodations' })
            ]);

            if (cancelled) return;

            const updatedItems: CounterItem[] = [];

            updatedItems.push({
                value: destinationsTotal ?? fallbackItems[0]?.value ?? 0,
                label: labels.destinations
            });

            updatedItems.push({
                value: accommodationsTotal ?? fallbackItems[1]?.value ?? 0,
                suffix: '+',
                label: labels.accommodations
            });

            setItems(updatedItems);
        }

        void loadStats();
        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl, labels, fallbackItems]);

    return (
        <AnimatedCounter
            items={items}
            className={className}
        />
    );
}
