import { AsyncLocalStorage } from 'node:async_hooks';

/** The priority assigned to an HTTP request that can reach a payment provider. */
export type TrafficClass = 'interactive' | 'background';

/** Counters collected for one cron run that uses the provider traffic governor. */
export interface TrafficCounterSink {
    /** Record one governed request and its class/capability outcome. */
    record(args: {
        readonly trafficClass: TrafficClass;
        readonly capability: string;
        readonly status?: number;
        readonly networkError?: boolean;
        readonly request?: boolean;
        readonly waitMs?: number;
        readonly fastFailure?: boolean;
        readonly coolDownMs?: number;
        readonly unclassified?: boolean;
        /** A provider read was served from the current row's read scope. */
        readonly memoHit?: boolean;
    }): void;
    /** Return a JSON-safe snapshot of this run's traffic counters. */
    toProviderTraffic(): Readonly<Record<string, unknown>>;
}

/**
 * Context propagated through async work. `signal` and `deadlineAt` are
 * declared for PR-4's cooperative cron budget and are unused in PR-1.
 */
export interface TrafficContext {
    readonly trafficClass: TrafficClass;
    readonly signal?: AbortSignal;
    readonly deadlineAt?: Date;
    readonly counters?: TrafficCounterSink;
}

const trafficContextStorage = new AsyncLocalStorage<TrafficContext>();

/** Run `fn` with the supplied traffic context; nested calls override parents. */
export function runWithTrafficClass<T>(args: {
    readonly context: TrafficContext;
    readonly fn: () => T;
}): T {
    return trafficContextStorage.run(args.context, args.fn);
}

/** Return the traffic context active in this asynchronous execution, if any. */
export function currentTrafficContext(): TrafficContext | undefined {
    return trafficContextStorage.getStore();
}
