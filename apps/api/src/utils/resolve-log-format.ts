/**
 * @file resolve-log-format.ts
 * @description Resolves the effective CONSOLE log format from the (optional)
 * `API_LOG_FORMAT` env var plus `NODE_ENV`. Kept as a small pure function so the
 * env-aware default is unit-testable without importing the side-effectful server
 * entry point (`index.ts`).
 *
 * This governs ONLY console output. The `app_log_entries` DB sink (SPEC-184) is
 * a separate structured logger hook and is unaffected by the returned format.
 */

/** Input for {@link resolveLogFormat}. */
export interface ResolveLogFormatInput {
    /** Explicit `API_LOG_FORMAT` value, or `undefined` when the var is unset. */
    readonly explicit: 'pretty' | 'json' | undefined;
    /** The validated `NODE_ENV`. */
    readonly nodeEnv: 'development' | 'production' | 'test';
}

/**
 * Resolve the console log format.
 *
 * An explicit `API_LOG_FORMAT` always wins. When unset, the default is
 * env-aware: `json` in production (parseable Coolify console, no ANSI), `pretty`
 * everywhere else.
 *
 * @param input - {@link ResolveLogFormatInput}
 * @returns The effective format, `'pretty'` or `'json'`.
 */
export const resolveLogFormat = ({ explicit, nodeEnv }: ResolveLogFormatInput): 'pretty' | 'json' =>
    explicit ?? (nodeEnv === 'production' ? 'json' : 'pretty');
