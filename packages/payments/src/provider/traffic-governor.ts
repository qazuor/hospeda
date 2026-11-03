import type { PaymentCapability } from './capabilities';
import { currentTrafficContext, type TrafficClass } from './traffic-context';
import { flushTrafficWindow } from './traffic-governor-flush';
import { type GovernorWaiter, paymentProviderRejection } from './traffic-governor-queue';
import {
    emptyCounter,
    type MutableCounter,
    type MutableWindow,
    type TrafficWindow
} from './traffic-governor-window';

/** Requests admitted per second by the in-process token bucket. */
export const GOVERNOR_RATE_PER_SECOND = 5;
/** Maximum tokens held by the in-process token bucket. */
export const GOVERNOR_BURST = 10;
/** Tokens kept available for interactive requests. */
export const GOVERNOR_INTERACTIVE_RESERVE = 2;
/** Default interactive wait budget in milliseconds. */
export const GOVERNOR_INTERACTIVE_MAX_WAIT_MS = 2000;
/** Maximum Retry-After cool-down in milliseconds. */
export const GOVERNOR_MAX_RETRY_AFTER_COOLDOWN_MS = 120_000;
/** Maximum exponential cool-down in milliseconds. */
export const GOVERNOR_MAX_BACKOFF_COOLDOWN_MS = 60_000;
/** Initial exponential cool-down in milliseconds. */
export const GOVERNOR_BASE_BACKOFF_MS = 2000;
/** Observation window size in milliseconds. */
export const GOVERNOR_WINDOW_MS = 60_000;
/** Maximum wait samples retained by one traffic window. */
export const GOVERNOR_MAX_WAIT_SAMPLES = 1000;

/** The governor either measures requests or enforces the measured limits. */
export type GovernorMode = 'observe' | 'enforce';

export type { TrafficCounter, TrafficWindow } from './traffic-governor-window';

/** Parameters reported when an interactive request receives HTTP 429. */
export interface InteractiveRateLimitedInfo {
    readonly capability: PaymentCapability;
    readonly retryAfterMs?: number;
}

/** Timer seam used by deterministic governor tests. */
export type GovernorSchedule = (ms: number, callback: () => void) => () => void;

/** In-memory seam for cool-down persistence; PR-3 can replace this with Redis. */
export interface CoolDownStore {
    /** Extend the cool-down without shortening an existing deadline. */
    extend(args: { readonly until: number }): void;
    /** Return the cool-down deadline in epoch milliseconds. */
    until(): number;
    /** Refresh the shared deadline within the store's bounded latency. */
    refresh?(): Promise<{ readonly fallback: boolean }>;
}

class MemoryCoolDownStore implements CoolDownStore {
    private deadline = 0;
    extend(args: { readonly until: number }): void {
        this.deadline = Math.max(this.deadline, args.until);
    }
    until(): number {
        return this.deadline;
    }
}

/**
 * Coordinates provider request rate and records per-class traffic windows.
 * Observe-mode waits are virtual: accounting records their estimated duration
 * while `acquire` resolves immediately and never changes adapter behavior.
 */
export class ProviderTrafficGovernor {
    private readonly modeValue: GovernorMode;
    private readonly rate: number;
    private readonly burst: number;
    private readonly reserve: number;
    private readonly now: () => number;
    private readonly schedule: GovernorSchedule;
    private readonly random: () => number;
    private readonly onWindow?: (window: TrafficWindow) => void;
    private readonly onInteractiveRateLimited?: (info: InteractiveRateLimitedInfo) => void;
    private readonly onError?: (error: unknown) => void;
    private readonly coolDownStore: CoolDownStore;
    private tokens: number;
    private lastRefill: number;
    private retrySequence = 0;
    private window: MutableWindow;
    private windowTimer: ReturnType<typeof setInterval> | undefined;
    private readonly interactiveQueue: GovernorWaiter[] = [];
    private readonly backgroundQueue: GovernorWaiter[] = [];
    private pumping = false;

    /** Create a governor with injectable time, scheduling, and logging seams. */
    constructor(options: {
        readonly mode: GovernorMode;
        readonly ratePerSecond?: number;
        readonly burst?: number;
        readonly interactiveReserve?: number;
        readonly now?: () => number;
        readonly schedule?: GovernorSchedule;
        readonly random?: () => number;
        readonly onWindow?: (window: TrafficWindow) => void;
        readonly onInteractiveRateLimited?: (info: InteractiveRateLimitedInfo) => void;
        readonly onError?: (error: unknown) => void;
        readonly coolDownStore?: CoolDownStore;
    }) {
        this.modeValue = options.mode;
        this.rate = options.ratePerSecond ?? GOVERNOR_RATE_PER_SECOND;
        this.burst = options.burst ?? GOVERNOR_BURST;
        this.reserve = options.interactiveReserve ?? GOVERNOR_INTERACTIVE_RESERVE;
        this.now = options.now ?? Date.now;
        this.schedule =
            options.schedule ??
            ((ms, callback) => {
                const timer = setTimeout(callback, ms);
                return () => clearTimeout(timer);
            });
        this.random = options.random ?? Math.random;
        this.onWindow = options.onWindow;
        this.onInteractiveRateLimited = options.onInteractiveRateLimited;
        this.onError = options.onError;
        this.coolDownStore = options.coolDownStore ?? new MemoryCoolDownStore();
        this.tokens = this.burst;
        this.lastRefill = this.now();
        this.window = { startedAt: this.now(), classes: new Map() };
    }

    /** Current governor mode. */
    get mode(): GovernorMode {
        return this.modeValue;
    }

    /**
     * Acquire a provider request. Observe mode always resolves immediately;
     * enforce mode waits for a token or rejects when its budget is exceeded.
     */
    acquire(args: {
        readonly trafficClass: TrafficClass;
        readonly capability: PaymentCapability;
        readonly maxWaitMs?: number;
        readonly signal?: AbortSignal;
        readonly unclassified?: boolean;
    }): Promise<void> {
        const context = currentTrafficContext();
        const signal = args.signal ?? context?.signal;
        const maxWaitMs =
            args.maxWaitMs ??
            (args.trafficClass === 'interactive' ? GOVERNOR_INTERACTIVE_MAX_WAIT_MS : Infinity);
        if (this.mode === 'observe') {
            try {
                const waitMs = this.shadowWait(args.trafficClass);
                const counter = this.counter(args.trafficClass, args.capability);
                counter.requests += 1;
                const fastFailure = args.trafficClass === 'interactive' && waitMs > maxWaitMs;
                if (!fastFailure) this.addWaitSample(args.trafficClass, counter, waitMs);
                if (args.unclassified) counter.unclassified += 1;
                if (fastFailure) counter.fastFailures += 1;
                context?.counters?.record({
                    trafficClass: args.trafficClass,
                    capability: args.capability,
                    request: true,
                    ...(fastFailure ? {} : { waitMs }),
                    fastFailure,
                    unclassified: args.unclassified
                });
            } catch (error) {
                this.reportError(error);
            }
            return Promise.resolve();
        }
        if (signal?.aborted)
            return Promise.reject(
                paymentProviderRejection({
                    capability: args.capability,
                    remainingMs: 0,
                    message: 'Mercado Pago traffic governor: request aborted'
                })
            );
        const enqueue = (): Promise<void> => {
            if (signal?.aborted)
                return Promise.reject(
                    paymentProviderRejection({
                        capability: args.capability,
                        remainingMs: 0,
                        message: 'Mercado Pago traffic governor: request aborted'
                    })
                );
            return new Promise<void>((resolve, reject) => {
                const waiter: GovernorWaiter = {
                    trafficClass: args.trafficClass,
                    capability: args.capability,
                    maxWaitMs,
                    startedAt: this.now(),
                    resolve,
                    reject,
                    ...(signal ? { signal } : {})
                };
                const queue =
                    args.trafficClass === 'interactive'
                        ? this.interactiveQueue
                        : this.backgroundQueue;
                queue.push(waiter);
                if (signal) {
                    waiter.abort = () =>
                        this.rejectWaiter(
                            waiter,
                            0,
                            'Mercado Pago traffic governor: request aborted'
                        );
                    signal.addEventListener('abort', waiter.abort, { once: true });
                }
                this.pump();
            });
        };
        if (!this.coolDownStore.refresh) return enqueue();
        return (async () => {
            try {
                const refreshed = await this.coolDownStore.refresh?.();
                if (refreshed?.fallback) {
                    const fallbackCounter = this.counter(args.trafficClass, args.capability);
                    fallbackCounter.redisFallbacks += 1;
                    context?.counters?.record({
                        trafficClass: args.trafficClass,
                        capability: args.capability,
                        redisFallback: true
                    });
                }
            } catch (error) {
                this.reportError(error);
            }
            return enqueue();
        })();
    }

    /** Observe a completed provider attempt and update counters/cool-down state. */
    observe(args: {
        readonly trafficClass: TrafficClass;
        readonly capability: PaymentCapability;
        readonly status?: number;
        readonly networkError?: boolean;
        readonly retryAfterMs?: number;
    }): void {
        let observedCoolDownMs: number | undefined;
        try {
            const counter = this.counter(args.trafficClass, args.capability);
            if (args.networkError) counter.networkErrors += 1;
            if (args.status !== undefined && args.status >= 200 && args.status < 300) {
                counter.status2xx += 1;
                this.retrySequence = 0;
            } else if (args.status === 429) {
                counter.status429 += 1;
                const rawDelay =
                    args.retryAfterMs === undefined
                        ? Math.min(
                              GOVERNOR_MAX_BACKOFF_COOLDOWN_MS,
                              GOVERNOR_BASE_BACKOFF_MS *
                                  2 ** this.retrySequence++ *
                                  (0.5 + 0.5 * this.random())
                          )
                        : Math.min(
                              GOVERNOR_MAX_RETRY_AFTER_COOLDOWN_MS,
                              Math.max(args.retryAfterMs, args.retryAfterMs + this.random() * 1000)
                          );
                const delay = Math.max(0, rawDelay);
                observedCoolDownMs = delay;
                const oldRemaining = this.coolDownRemainingMs();
                this.coolDownStore.extend({ until: this.now() + delay });
                counter.coolDowns += 1;
                counter.coolDownMs += Math.max(0, delay - oldRemaining);
                if (args.trafficClass === 'interactive') {
                    this.onInteractiveRateLimited?.({
                        capability: args.capability,
                        ...(args.retryAfterMs === undefined
                            ? {}
                            : { retryAfterMs: args.retryAfterMs })
                    });
                }
                this.pump();
            } else if (args.status !== undefined && args.status >= 500) {
                counter.status5xx += 1;
            }
            currentTrafficContext()?.counters?.record({
                trafficClass: args.trafficClass,
                capability: args.capability,
                ...(args.status === undefined ? {} : { status: args.status }),
                ...(args.networkError ? { networkError: true } : {}),
                ...(observedCoolDownMs === undefined ? {} : { coolDownMs: observedCoolDownMs })
            });
        } catch (error) {
            this.reportError(error);
        }
    }

    /** Flush and reset the current window, returning undefined when it is empty. */
    flushWindow(): TrafficWindow | undefined {
        const flushed = flushTrafficWindow({
            current: this.window,
            mode: this.mode,
            now: this.now(),
            onWindow: this.onWindow,
            onError: (error) => this.reportError(error)
        });
        this.window = flushed.current;
        return flushed.first;
    }

    /** Start the unref'd periodic window flush. */
    start(): void {
        if (this.windowTimer) return;
        this.windowTimer = setInterval(() => {
            const windows = this.flushWindow();
            if (windows) return;
        }, GOVERNOR_WINDOW_MS);
        this.windowTimer.unref();
    }

    /** Stop the periodic flush timer. */
    stop(): void {
        if (this.windowTimer) clearInterval(this.windowTimer);
        this.windowTimer = undefined;
    }

    /** Return the remaining in-process cool-down duration in milliseconds. */
    coolDownRemainingMs(): number {
        return Math.max(0, this.coolDownStore.until() - this.now());
    }

    /** Record a provider read served from a memoized scope. */
    recordMemoHit(args: {
        readonly trafficClass: TrafficClass;
        readonly capability: string;
    }): void {
        try {
            this.counter(args.trafficClass, args.capability).memoHits += 1;
        } catch (error) {
            this.reportError(error);
        }
    }

    private counter(trafficClass: TrafficClass, capability: string): MutableCounter {
        let classMap = this.window.classes.get(trafficClass);
        if (!classMap) {
            classMap = new Map();
            this.window.classes.set(trafficClass, classMap);
        }
        let counter = classMap.get(capability);
        if (!counter) {
            counter = emptyCounter();
            classMap.set(capability, counter);
        }
        return counter;
    }

    private addWaitSample(
        trafficClass: TrafficClass,
        counter: MutableCounter,
        waitMs: number
    ): void {
        const classCounters = this.window.classes.get(trafficClass);
        const sampleCount = [...(classCounters?.values() ?? [])].reduce(
            (total, item) => total + item.waitSamples.length,
            0
        );
        if (sampleCount >= GOVERNOR_MAX_WAIT_SAMPLES) {
            for (const item of classCounters?.values() ?? []) {
                if (item.waitSamples.length === 0) continue;
                item.waitSamples.shift();
                break;
            }
        }
        counter.waitSamples.push(waitMs);
    }

    private shadowWait(trafficClass: TrafficClass): number {
        const now = this.now();
        this.tokens = Math.min(
            this.burst,
            this.tokens + (Math.max(0, now - this.lastRefill) * this.rate) / 1000
        );
        this.lastRefill = now;
        const threshold = trafficClass === 'background' ? this.reserve + 1 : 1;
        const tokenWait =
            this.tokens >= threshold ? 0 : ((threshold - this.tokens) / this.rate) * 1000;
        this.tokens -= 1;
        return Math.max(tokenWait, this.coolDownRemainingMs());
    }

    private pump(): void {
        if (this.pumping) return;
        this.pumping = true;
        try {
            this.refill();
            const nextClass = this.interactiveQueue.length > 0 ? 'interactive' : 'background';
            const queue =
                nextClass === 'interactive' ? this.interactiveQueue : this.backgroundQueue;
            const waiter = queue[0];
            if (!waiter) return;
            const cooldown = this.coolDownRemainingMs();
            const tokenAvailable =
                nextClass === 'interactive' ? this.tokens >= 1 : this.tokens > this.reserve;
            const tokenWait = tokenAvailable
                ? 0
                : Math.max(
                      1,
                      ((1 - (this.tokens - (nextClass === 'background' ? this.reserve : 0))) /
                          this.rate) *
                          1000
                  );
            const wait = Math.max(cooldown, tokenWait);
            if (wait === 0) {
                queue.shift();
                this.tokens -= 1;
                this.finishWaiter(waiter);
                waiter.resolve();
                queueMicrotask(() => this.pump());
                return;
            }
            if (nextClass === 'interactive' && wait > waiter.maxWaitMs) {
                this.rejectWaiter(waiter, wait);
                this.pump();
                return;
            }
            const delay = Math.max(
                1,
                Math.min(wait, Number.isFinite(waiter.maxWaitMs) ? waiter.maxWaitMs : wait)
            );
            waiter.cancelTimer?.();
            waiter.cancelTimer = this.schedule(delay, () => {
                waiter.cancelTimer = undefined;
                if (this.now() - waiter.startedAt >= waiter.maxWaitMs) {
                    this.rejectWaiter(waiter, wait);
                }
                this.pump();
            });
        } finally {
            this.pumping = false;
        }
    }

    private refill(): void {
        const now = this.now();
        this.tokens = Math.min(
            this.burst,
            this.tokens + (Math.max(0, now - this.lastRefill) * this.rate) / 1000
        );
        this.lastRefill = now;
    }

    private finishWaiter(waiter: GovernorWaiter): void {
        waiter.cancelTimer?.();
        if (waiter.abort) waiter.signal?.removeEventListener('abort', waiter.abort);
        const waited = Math.max(0, this.now() - waiter.startedAt);
        const counter = this.counter(waiter.trafficClass, waiter.capability);
        counter.requests += 1;
        this.addWaitSample(waiter.trafficClass, counter, waited);
        currentTrafficContext()?.counters?.record({
            trafficClass: waiter.trafficClass,
            capability: waiter.capability,
            request: true,
            waitMs: waited
        });
    }

    private rejectWaiter(waiter: GovernorWaiter, remainingMs: number, message?: string): void {
        const queue =
            waiter.trafficClass === 'interactive' ? this.interactiveQueue : this.backgroundQueue;
        const index = queue.indexOf(waiter);
        if (index < 0) return;
        queue.splice(index, 1);
        waiter.cancelTimer?.();
        if (waiter.abort) waiter.signal?.removeEventListener('abort', waiter.abort);
        const counter = this.counter(waiter.trafficClass, waiter.capability);
        counter.fastFailures += 1;
        currentTrafficContext()?.counters?.record({
            trafficClass: waiter.trafficClass,
            capability: waiter.capability,
            fastFailure: true
        });
        waiter.reject(
            paymentProviderRejection({
                capability: waiter.capability,
                remainingMs,
                ...(message ? { message } : {})
            })
        );
        queueMicrotask(() => this.pump());
    }

    private reportError(error: unknown): void {
        try {
            this.onError?.(error);
        } catch {
            /* Bookkeeping must remain fail-open. */
        }
    }
}
