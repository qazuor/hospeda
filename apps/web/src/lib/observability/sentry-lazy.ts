/**
 * @file sentry-lazy.ts
 * @description Lazy facade over `@sentry/astro` for browser code (HOS-369).
 *
 * WHY THIS EXISTS
 * The Sentry browser SDK plus Session Replay is ~236 KB raw / ~78 KB over the
 * wire, and it used to be a STATIC import from `sentry.client.config.ts`, which
 * `@sentry/astro` emits as a `<script type="module">` in every page's `<head>`.
 * Module scripts are fetched at high priority immediately, so those bytes
 * competed with the LCP image on a bandwidth-bound mobile connection — for every
 * visitor, including the majority who never consent to crash reporting, because
 * the consent check in `sentry.client.config.ts` gates `Sentry.init()`, NOT the
 * download.
 *
 * Every browser-side `@sentry/astro` import now goes through this module, which
 * never imports the SDK at module scope. The SDK is pulled in exactly once, by
 * `sentry.client.config.ts`, and only when the visitor consented — see
 * {@link registerSentry}.
 *
 * DO NOT re-add `import * as Sentry from '@sentry/astro'` to any file under
 * `src/` that runs in the browser. A single static import anywhere in an island's
 * graph pulls the whole SDK back onto the critical path and silently undoes this.
 * `test/lib/observability/sentry-lazy.test.ts` guards the current call sites.
 *
 * Server-side code (`middleware-helpers.ts`, `internal-bypass-report.ts`,
 * `sentry.server.config.ts`) is unaffected and keeps importing the SDK directly:
 * it never ships to the browser.
 */

import { webLogger } from '@/lib/logger';

/** The subset of the Sentry SDK surface this app actually calls in the browser. */
interface SentryBrowserApi {
    captureException(error: unknown, hint?: Record<string, unknown>): string;
    lastEventId?: () => string | undefined;
    captureFeedback?: (payload: Record<string, unknown>) => void;
}

/**
 * The initialised SDK, published by `sentry.client.config.ts` once it has
 * dynamically imported and `init()`-ed it. `undefined` means either "not loaded
 * yet" or "will never load" (no crash-reporting consent / no DSN) — deliberately
 * indistinguishable to callers, because both cases must behave the same: do not
 * report.
 */
let sentry: SentryBrowserApi | undefined;

/**
 * Exceptions raised before the SDK finished loading. Bounded: an error loop must
 * not grow this without limit. Flushed by {@link registerSentry}; if the SDK
 * never loads (no consent), the buffer is simply never sent — which is the same
 * outcome as before this refactor, where `captureException` was a no-op because
 * `Sentry.init()` had not run.
 */
const MAX_BUFFERED_EXCEPTIONS = 10;
let buffered: Array<{ error: unknown; hint?: Record<string, unknown> }> = [];

/**
 * Publish the initialised SDK and flush anything captured while it was loading.
 * Called ONLY by `sentry.client.config.ts`.
 *
 * @param loaded - The initialised `@sentry/astro` module namespace.
 */
export function registerSentry(loaded: SentryBrowserApi): void {
    sentry = loaded;
    const pending = buffered;
    buffered = [];
    for (const { error, hint } of pending) {
        try {
            loaded.captureException(error, hint);
        } catch {
            // Reporting an error must never itself throw.
        }
    }
}

/**
 * Report an exception to Sentry.
 *
 * Safe to call at any time. Before the SDK is available the exception is
 * buffered (up to {@link MAX_BUFFERED_EXCEPTIONS}) and replayed on
 * {@link registerSentry}; if the SDK never loads, nothing is sent.
 *
 * @param error - The thrown value.
 * @param hint - Optional Sentry capture context (`contexts`, `tags`, ...).
 */
export function captureException(error: unknown, hint?: Record<string, unknown>): void {
    if (sentry) {
        try {
            sentry.captureException(error, hint);
        } catch {
            // Never let reporting failure surface to the caller.
        }
        return;
    }
    if (buffered.length >= MAX_BUFFERED_EXCEPTIONS) {
        webLogger.debug('[sentry-lazy] exception buffer full, dropping', {
            limit: MAX_BUFFERED_EXCEPTIONS
        });
        return;
    }
    buffered.push(hint ? { error, hint } : { error });
}

/**
 * Most recent Sentry event id, used to correlate a feedback submission with the
 * error the user just hit. Returns `undefined` when the SDK is not loaded — the
 * same value the previous `Sentry.lastEventId?.()` call produced when
 * `Sentry.init()` had not run.
 */
export function getLastEventId(): string | undefined {
    try {
        return sentry?.lastEventId?.();
    } catch {
        return undefined;
    }
}

/**
 * Mirror a feedback submission into Sentry's User Feedback channel. No-op when
 * the SDK is not loaded or does not expose `captureFeedback`.
 *
 * @param payload - Sentry `captureFeedback` payload.
 */
export function captureFeedback(payload: Record<string, unknown>): void {
    try {
        sentry?.captureFeedback?.(payload);
    } catch {
        // Intentional no-op — Sentry failure must not block feedback submission.
    }
}

/**
 * Whether the SDK is loaded and initialised. Exposed for tests and diagnostics;
 * app code should just call the functions above, which are all no-op-safe.
 */
export function isSentryLoaded(): boolean {
    return sentry !== undefined;
}

/**
 * Test-only reset of module state. Not called by app code.
 */
export function resetSentryLazyForTests(): void {
    sentry = undefined;
    buffered = [];
}
