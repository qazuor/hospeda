import type { GovernorMode } from './traffic-governor';
import {
    emptyCounter,
    type MutableWindow,
    snapshotCounter,
    type TrafficWindow
} from './traffic-governor-window';

/** Flush class counters into loggable windows and return the resettable state. */
export function flushTrafficWindow(args: {
    readonly current: MutableWindow;
    readonly mode: GovernorMode;
    readonly now: number;
    readonly onWindow?: (window: TrafficWindow) => void;
    readonly onError: (error: unknown) => void;
}): { readonly current: MutableWindow; readonly first?: TrafficWindow } {
    const traffic = [...args.current.classes.entries()].filter(([, capabilities]) =>
        [...capabilities.values()].some(
            (counter) =>
                counter.requests > 0 ||
                counter.status2xx > 0 ||
                counter.status429 > 0 ||
                counter.status5xx > 0 ||
                counter.networkErrors > 0 ||
                counter.fastFailures > 0 ||
                counter.memoHits > 0 ||
                counter.redisFallbacks > 0
        )
    );
    if (traffic.length === 0) return { current: { startedAt: args.now, classes: new Map() } };
    const windows = traffic.map(([trafficClass, capabilities]) => {
        const entries = [...capabilities.entries()];
        const totals = emptyCounter();
        for (const [, value] of entries) {
            totals.requests += value.requests;
            totals.status2xx += value.status2xx;
            totals.status429 += value.status429;
            totals.status5xx += value.status5xx;
            totals.networkErrors += value.networkErrors;
            totals.waitSamples.push(...value.waitSamples);
            totals.fastFailures += value.fastFailures;
            totals.coolDowns += value.coolDowns;
            totals.coolDownMs += value.coolDownMs;
            totals.unclassified += value.unclassified;
            totals.memoHits += value.memoHits;
            totals.redisFallbacks += value.redisFallbacks;
        }
        return {
            ...snapshotCounter(totals),
            mode: args.mode,
            trafficClass,
            windowStartedAt: new Date(args.current.startedAt).toISOString(),
            windowEndedAt: new Date(args.now).toISOString(),
            byCapability: Object.fromEntries(
                entries.map(([key, value]) => [key, snapshotCounter(value)])
            )
        } satisfies TrafficWindow;
    });
    for (const window of windows) {
        try {
            args.onWindow?.(window);
        } catch (error) {
            args.onError(error);
        }
    }
    return {
        current: { startedAt: args.now, classes: new Map() },
        first: windows[0]
    };
}
