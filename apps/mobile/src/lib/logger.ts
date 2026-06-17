/**
 * @file logger.ts
 * @description RN-safe logging seam for the Hospeda mobile app.
 *
 * `@repo/logger` depends on `chalk` (Node `tty`) and `dotenv` (Node `fs`),
 * which break Metro bundling — so the mobile app uses this thin wrapper
 * instead. All calls forward to the native `console` API, giving a single
 * seam that a future RN-compatible logger can replace without touching any
 * call sites.
 *
 * ADR-033 note: `@repo/logger` is NOT Metro-safe. If RN logging needs to be
 * routed to a remote service (Sentry, Datadog, etc.), extend this module —
 * do not attempt to import `@repo/logger` directly in mobile.
 *
 * @module lib/logger
 */

/**
 * Log level labels mirroring the `@repo/logger` surface so call sites can
 * be migrated without signature changes.
 */
type LogArgs = readonly unknown[];

/**
 * Minimal logger interface for the mobile app.
 *
 * Mirrors the four most-used methods from `@repo/logger` (`warn`, `info`,
 * `error`, `debug`) so future adoption of a proper RN-safe logger is a
 * drop-in swap.
 */
export interface MobileLogger {
    /**
     * Logs a warning message. Maps to `console.warn`.
     * @param args - Message and optional additional values.
     */
    readonly warn: (...args: LogArgs) => void;

    /**
     * Logs an informational message. Maps to `console.info`.
     * @param args - Message and optional additional values.
     */
    readonly info: (...args: LogArgs) => void;

    /**
     * Logs an error message. Maps to `console.error`.
     * @param args - Message and optional additional values.
     */
    readonly error: (...args: LogArgs) => void;

    /**
     * Logs a debug message. Maps to `console.debug`.
     * @param args - Message and optional additional values.
     */
    readonly debug: (...args: LogArgs) => void;
}

/**
 * The default mobile logger. Forwards every call to the built-in `console`
 * methods — no Node-specific dependencies, fully Metro-compatible.
 *
 * @example
 * ```ts
 * import { logger } from '../lib/logger';
 * logger.warn('[push] Permission denied.');
 * ```
 */
export const logger: MobileLogger = {
    // eslint-disable-next-line no-console
    warn: (...args: LogArgs): void => {
        console.warn(...args);
    },
    // eslint-disable-next-line no-console
    info: (...args: LogArgs): void => {
        console.info(...args);
    },
    // eslint-disable-next-line no-console
    error: (...args: LogArgs): void => {
        console.error(...args);
    },
    // eslint-disable-next-line no-console
    debug: (...args: LogArgs): void => {
        console.debug(...args);
    }
} as const;
