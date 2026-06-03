/**
 * Generic log hook registry.
 *
 * A dependency-injected mechanism that lets consumers observe every structured
 * log entry AFTER it is dispatched to the console, WITHOUT pulling their
 * dependencies (Sentry, a DB client, etc.) into `@repo/logger`. The package
 * stays dependency-free; the API wires concrete hooks at startup.
 *
 * Shared by:
 * - SPEC-184 — a sink hook that persists WARN+ERROR entries to `app_log_entries`.
 * - SPEC-180 — a capture hook that forwards errors to Sentry.
 *
 * Both register here under distinct names; this is the single registry, not a
 * per-feature mechanism.
 *
 * @module logger/hooks
 */

import type { LogEntry } from './log-entry.js';

/**
 * A hook invoked once per structured log entry. May be sync or async; async
 * hooks are fire-and-forget (their rejection is swallowed and reported to
 * stderr, never bubbled into the logging call site).
 */
export type LogHookFn = (entry: LogEntry) => void | Promise<void>;

/** Registry keyed by hook name. Re-registering the same name replaces it. */
const hookRegistry = new Map<string, LogHookFn>();

/**
 * Register (or replace) a log hook.
 * @param name - Unique hook name (e.g. 'db-sink', 'sentry-capture')
 * @param fn - The hook callback
 */
export function registerHook(name: string, fn: LogHookFn): void {
    hookRegistry.set(name, fn);
}

/**
 * Remove a previously registered hook. No-op if the name is not registered.
 * Primarily used to reset state between tests.
 * @param name - The hook name to remove
 */
export function unregisterHook(name: string): void {
    hookRegistry.delete(name);
}

/**
 * Remove ALL registered hooks. Test/teardown helper.
 */
export function clearHooks(): void {
    hookRegistry.clear();
}

/**
 * Whether any hook is currently registered. Callers use this to avoid building
 * a {@link LogEntry} when there is nothing to dispatch to.
 * @returns True if at least one hook is registered
 */
export function hasHooks(): boolean {
    return hookRegistry.size > 0;
}

/**
 * Report a hook failure to stderr without bubbling it into the logging call.
 *
 * Hooks only run in Node (they are registered by the API at startup), so
 * `process.stderr` is always present in practice. The guard keeps the package
 * browser-safe; in the unreachable non-Node case the (already non-fatal) hook
 * error is dropped silently.
 */
function reportHookError(name: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    if (typeof process !== 'undefined' && process.stderr?.write) {
        process.stderr.write(`[logger] hook "${name}" failed: ${detail}\n`);
    }
}

/**
 * Dispatch a structured entry to every registered hook. Fire-and-forget:
 * synchronous throws and asynchronous rejections are caught and reported to
 * stderr, so a misbehaving hook never breaks a logging call.
 * @param entry - The structured log entry to dispatch
 */
export function dispatchHooks(entry: LogEntry): void {
    for (const [name, fn] of hookRegistry) {
        try {
            const result = fn(entry);
            if (result instanceof Promise) {
                result.catch((err) => reportHookError(name, err));
            }
        } catch (err) {
            reportHookError(name, err);
        }
    }
}
