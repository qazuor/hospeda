import type { TrafficClass } from './traffic-context';

/** Stable counters emitted for one class/capability in an observation window. */
export interface TrafficCounter {
    readonly requests: number;
    readonly status2xx: number;
    readonly status429: number;
    readonly status5xx: number;
    readonly networkErrors: number;
    readonly waitMs: { readonly p50: number; readonly p95: number; readonly max: number };
    readonly fastFailures: number;
    readonly coolDowns: number;
    readonly coolDownMs: number;
    readonly unclassified: number;
    readonly memoHits: 0;
    readonly snapshotHits: 0;
    readonly redisFallbacks: 0;
}

/** A completed observation window for one traffic class. */
export interface TrafficWindow extends TrafficCounter {
    readonly mode: 'observe' | 'enforce';
    readonly trafficClass: TrafficClass;
    readonly windowStartedAt: string;
    readonly windowEndedAt: string;
    readonly byCapability: Readonly<Record<string, TrafficCounter>>;
}

/** Internal mutable counters used while a governor window is open. */
export interface MutableCounter {
    requests: number;
    status2xx: number;
    status429: number;
    status5xx: number;
    networkErrors: number;
    waitSamples: number[];
    fastFailures: number;
    coolDowns: number;
    coolDownMs: number;
    unclassified: number;
}

/** Internal mutable window state grouped by traffic class and capability. */
export interface MutableWindow {
    startedAt: number;
    readonly classes: Map<TrafficClass, Map<string, MutableCounter>>;
}

/** Create a zeroed internal traffic counter. */
export function emptyCounter(): MutableCounter {
    return {
        requests: 0,
        status2xx: 0,
        status429: 0,
        status5xx: 0,
        networkErrors: 0,
        waitSamples: [],
        fastFailures: 0,
        coolDowns: 0,
        coolDownMs: 0,
        unclassified: 0
    };
}

function percentile(samples: readonly number[], percentileRank: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileRank) - 1)] ?? 0;
}

/** Convert mutable window counters to the stable, JSON-safe traffic shape. */
export function snapshotCounter(counter: MutableCounter): TrafficCounter {
    return {
        requests: counter.requests,
        status2xx: counter.status2xx,
        status429: counter.status429,
        status5xx: counter.status5xx,
        networkErrors: counter.networkErrors,
        waitMs: {
            p50: percentile(counter.waitSamples, 0.5),
            p95: percentile(counter.waitSamples, 0.95),
            max: counter.waitSamples.length === 0 ? 0 : Math.max(...counter.waitSamples)
        },
        fastFailures: counter.fastFailures,
        coolDowns: counter.coolDowns,
        coolDownMs: counter.coolDownMs,
        unclassified: counter.unclassified,
        memoHits: 0,
        snapshotHits: 0,
        redisFallbacks: 0
    };
}
