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
