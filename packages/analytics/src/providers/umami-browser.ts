/**
 * Browser-side Umami client (HOS-2119, T-020).
 *
 * A thin, safe wrapper over the global `window.umami` tracker (Umami 3.5:
 * `umami.track(name, data)`, `umami.track(fn)`, `umami.identify(id, data)`).
 * It implements {@link BrowserAnalyticsClient}, so it plugs into
 * `createBrowserAnalytics({ getClient })`, which owns catalog validation.
 *
 * The tracker is resolved on EVERY call, never at construction: the Umami
 * script is loaded deferred, so it may appear after the client is created, or
 * never (ad blocker, SSR). In those cases every method is a silent no-op.
 */
import type { BrowserAnalyticsClient } from '../browser.js';

/** Subset of the Umami tracker used by this package. */
export interface UmamiTracker {
    /** Sends an event by name, or a custom payload built from the defaults. */
    track(
        nameOrBuilder: string | ((defaults: Record<string, unknown>) => Record<string, unknown>),
        data?: Record<string, unknown>
    ): void;
    /** Attaches a distinct id and/or session data to the current session. */
    identify(id: string, data?: Record<string, unknown>): void;
}

/** Input of {@link UmamiBrowserClient.captureTagged}. */
export interface CaptureTaggedInput {
    /** Event name. */
    readonly name: string;
    /** Flat event data. */
    readonly data?: Record<string, unknown>;
    /** Umami tag, used for per-entity breakdowns. */
    readonly tag: string;
}

/** Browser analytics client backed by Umami. */
export interface UmamiBrowserClient extends BrowserAnalyticsClient {
    /** Sends an event carrying an Umami `tag`. No-op when the tracker is missing. */
    captureTagged(input: CaptureTaggedInput): void;
    /** Always present on this client (optional on the base interface). */
    identify(distinctId: string, properties?: Record<string, unknown>): void;
}

/** Input of {@link hasUmamiCacheToken}. */
export interface HasUmamiCacheTokenInput {
    /** The tracker to probe (`window.umami`), of any shape. */
    readonly tracker: unknown;
}

/**
 * Whether the tracker holds Umami's `x-umami-cache` token, read through its
 * `getSession()` (Umami 3.5.0: `{ cache, ... }`).
 *
 * The tracker stores the token from the answer of each request it sends and
 * keeps it in memory for the life of the document. An `identify` sent while it
 * holds the token CLAIMS the anonymous fingerprint session (and every later
 * visitor on that device keeps landing in it); one sent without it opens the
 * per-user `uuid(…, id)` session (OQ-5 revised 2026-11-17,
 * `docs/analytics/umami-spike.md` §2). Callers use this as a guard: identify
 * only while the tracker does NOT hold a token. A tracker without
 * `getSession`, or one that throws, counts as not holding it. Never throws.
 *
 * Re-check this contract (`getSession()` and its `cache` field) on every
 * Umami upgrade.
 *
 * @param input - The tracker to probe.
 * @returns `true` only for a non-empty string token.
 */
export function hasUmamiCacheToken({ tracker }: HasUmamiCacheTokenInput): boolean {
    try {
        if (typeof tracker !== 'object' || tracker === null) return false;
        const getSession: unknown = Reflect.get(tracker, 'getSession');
        if (typeof getSession !== 'function') return false;
        const session: unknown = Reflect.apply(getSession, tracker, []);
        if (typeof session !== 'object' || session === null) return false;
        const cache: unknown = Reflect.get(session, 'cache');
        return typeof cache === 'string' && cache.length > 0;
    } catch {
        return false;
    }
}

function resolveTracker(): UmamiTracker | undefined {
    const win = (globalThis as { window?: { umami?: UmamiTracker } }).window;
    return win?.umami;
}

/**
 * Creates the Umami browser client. Never throws and never captures the
 * tracker at construction.
 *
 * @returns A {@link UmamiBrowserClient}
 *
 * @example
 * ```ts
 * const umami = createUmamiBrowserClient();
 * const analytics = createBrowserAnalytics({ enabled: true, getClient: () => umami });
 * ```
 */
export function createUmamiBrowserClient(): UmamiBrowserClient {
    return {
        capture(name, properties) {
            try {
                resolveTracker()?.track(name, properties);
            } catch {
                // Analytics are best-effort and must never break the page.
            }
        },
        captureTagged({ name, data, tag }) {
            try {
                resolveTracker()?.track((defaults) => ({
                    ...defaults,
                    name,
                    ...(data ? { data } : {}),
                    tag
                }));
            } catch {
                // Best-effort.
            }
        },
        identify(distinctId, properties) {
            try {
                const tracker = resolveTracker();
                if (!tracker) return;
                if (properties) tracker.identify(distinctId, properties);
                else tracker.identify(distinctId);
            } catch {
                // Best-effort.
            }
        },
        reset() {
            // Umami has no reset API: the session is derived server-side.
        }
    };
}
