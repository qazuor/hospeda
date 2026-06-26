/**
 * Sentry-free capture hook registry for forwarding error-level log entries
 * to an external error tracking service (e.g. Sentry).
 *
 * The `@repo/logger` package deliberately has zero runtime dependencies on
 * `@sentry/node` or any other external service. Instead, call sites that need
 * forwarding pass `{ capture: true }` in `LoggerOptions`; the logger package
 * dispatches to the hook registered here. The API wires the concrete Sentry
 * `captureException` call at startup — after `Sentry.init()` — via
 * `registerCaptureHook`.
 *
 * Design decisions:
 * - Only `ERROR` level entries with `capture: true` invoke the hook.
 * - `WARN` level entries are intentionally excluded from capture (not actionable
 *   enough to create Sentry issues; use Sentry breadcrumbs separately if needed).
 * - A second `registerCaptureHook` call replaces the previous hook (single
 *   capture destination; simplicity over extensibility).
 * - The hook signature uses `unknown` for the error value, mirroring the way
 *   `Sentry.captureException` handles non-Error values.
 *
 * @module logger/capture
 * @since SPEC-180 BETA-64
 */

/**
 * A function that receives an error value and structured context from an
 * `ERROR`-level log call that had `capture: true` in its options.
 *
 * Implementations are expected to forward the error to an external service
 * (e.g. `Sentry.captureException(error, { extra })`). The hook is fire-and-forget;
 * errors thrown inside it are silently swallowed so a broken hook never
 * propagates into the logging call site.
 *
 * @param error - The raw value passed to `logger.error()`.
 * @param extra - The structured `extra` context derived from the log entry:
 *   `{ label, category, data }`. Passed as `extra` to Sentry so the event
 *   shows the full log context.
 */
export type CaptureHookFn = (error: unknown, extra: Record<string, unknown>) => void;

/** Module-level singleton. `null` = not registered. */
let captureHook: CaptureHookFn | null = null;

/**
 * Register (or replace) the global error capture hook.
 *
 * Call this ONCE at application startup, AFTER the external service (e.g.
 * Sentry) has been initialised. Re-registering replaces the previous hook,
 * which is useful in test environments to swap implementations between tests.
 *
 * The hook is only invoked when:
 * 1. The log level is `ERROR`, AND
 * 2. `LoggerOptions.capture === true` is set at the call site.
 *
 * @param fn - The capture function to register.
 *
 * @example
 * ```ts
 * import * as Sentry from '@sentry/node';
 * import { registerCaptureHook } from '@repo/logger';
 *
 * // After Sentry.init():
 * registerCaptureHook((error, extra) => {
 *   Sentry.captureException(error, { extra });
 * });
 * ```
 */
export function registerCaptureHook(fn: CaptureHookFn): void {
    captureHook = fn;
}

/**
 * Remove the registered capture hook. Primarily used to reset state between
 * tests. No-op when no hook is registered.
 */
export function unregisterCaptureHook(): void {
    captureHook = null;
}

/**
 * Whether a capture hook is currently registered.
 * Callers use this to avoid building extra context when nothing is listening.
 *
 * @returns `true` if a hook has been registered via {@link registerCaptureHook}.
 */
export function hasCaptureHook(): boolean {
    return captureHook !== null;
}

/**
 * Invoke the registered capture hook with the given error and extra context.
 *
 * This is an internal function called by `logWithLevel` in `logger.ts` when
 * `level === ERROR && options.capture === true`. It is exported only so that
 * `logger.ts` can import it without a circular dependency.
 *
 * Errors thrown synchronously by the hook are caught and reported to `stderr`,
 * matching the fire-and-forget contract of {@link dispatchHooks}.
 *
 * @param error - The raw value logged by the call site.
 * @param extra - Structured context from the log entry.
 */
export function invokeCaptureHook(error: unknown, extra: Record<string, unknown>): void {
    if (captureHook === null) {
        return;
    }
    try {
        captureHook(error, extra);
    } catch (hookErr) {
        const detail = hookErr instanceof Error ? hookErr.message : String(hookErr);
        if (typeof process !== 'undefined' && process.stderr?.write) {
            process.stderr.write(`[logger] captureHook failed: ${detail}\n`);
        }
    }
}
