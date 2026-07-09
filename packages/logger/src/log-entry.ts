/**
 * Structured log entry shared by the NDJSON output path, the log hook registry
 * (sink + capture) and the `app_log_entries` DB sink. Having a single builder
 * guarantees those three consumers never diverge.
 *
 * @module logger/log-entry
 */

import { capLogData } from './cap-data.js';
import { getConfig } from './config.js';
import { redactSensitiveData } from './redact.js';
import type { LoggerOptions, LogLevel, LogLevelType } from './types.js';

/**
 * A serialization-ready, structured log entry. Any sensitive data in `data` (or
 * inlined into `message`) is already redacted.
 */
export type LogEntry = {
    /** ISO-8601 timestamp */
    readonly ts: string;

    /** Log level */
    readonly level: LogLevelType;

    /** Category key, present only when not the DEFAULT category */
    readonly category?: string;

    /** Optional per-entry label */
    readonly label?: string;

    /** Textual message — string values are placed here directly */
    readonly message: string;

    /** Structured payload — non-string values are placed here, already redacted */
    readonly data?: unknown;
};

/**
 * Core {@link LogEntry} keys the context provider must never be able to set.
 * They carry structural meaning (or already-redacted/capped payloads) and are
 * always applied by `buildLogEntry` itself, so any same-named field coming
 * from `getContext()` is stripped before the merge.
 */
const RESERVED_ENTRY_KEYS: ReadonlySet<string> = new Set([
    'ts',
    'level',
    'category',
    'label',
    'message',
    'data'
]);

/**
 * Reads the configured `getContext` provider (see `BaseLoggerConfig.getContext`
 * in `./types.js`) and returns whatever contextual fields it yields, with any
 * {@link RESERVED_ENTRY_KEYS} stripped so context can never clobber a core
 * field.
 *
 * Read lazily (inside this function, not at module scope) to sidestep any
 * circular-import risk between `config.ts` and `log-entry.ts` — `config.ts`
 * does not currently import this module, but reading the provider here
 * rather than caching it at import time keeps the two modules decoupled
 * regardless of future changes.
 *
 * Never throws: a missing provider, a provider that throws, or a provider
 * that returns a non-object is all treated as "no extra context" so a single
 * misbehaving provider can never break logging.
 *
 * @returns Contextual fields to merge into the log entry, or `undefined`.
 */
function readContextFields(): Record<string, unknown> | undefined {
    try {
        const fields = getConfig().getContext?.();
        if (fields === null || typeof fields !== 'object') {
            return undefined;
        }
        const safe: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(fields)) {
            if (!RESERVED_ENTRY_KEYS.has(key)) {
                safe[key] = val;
            }
        }
        return Object.keys(safe).length > 0 ? safe : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Build a structured {@link LogEntry} from raw log arguments.
 *
 * Positional signature mirrors `formatLogMessage` / `formatLogArgs` (its callers)
 * for consistency within the logger package. Applies sensitive-data redaction;
 * string values land in `message`, non-string values land in `data` (with
 * `message` falling back to the label or an empty string).
 *
 * When a `getContext` provider is configured (see `BaseLoggerConfig.getContext`),
 * its returned fields are merged into the entry's top level — e.g. an API app
 * can inject `requestId` / `userId` / `sessionId` / `visitorId` from an
 * AsyncLocalStorage-based request context. Context fields can never override
 * any core field (`ts`, `level`, `category`, `label`, `message`, `data`): those
 * keys are stripped from the provider's output (see {@link RESERVED_ENTRY_KEYS})
 * and the core values are also spread last as belt-and-suspenders.
 *
 * @param level - Log level
 * @param value - Logged value
 * @param label - Optional label
 * @param options - Optional logger options (used for category)
 * @returns The structured log entry
 */
export function buildLogEntry(
    level: LogLevel,
    value: unknown,
    label?: string,
    options?: LoggerOptions
): LogEntry {
    const redacted = redactSensitiveData(value);
    const isStringValue = typeof redacted === 'string';

    const categoryKey = options?.category;
    const category =
        categoryKey !== undefined && categoryKey !== 'DEFAULT' ? categoryKey : undefined;

    // Bound the structured payload so a single oversized `data` value cannot
    // flood the JSON/NDJSON log (and the DB sink) regardless of the call site.
    // String values live in `message` and are left as-is (human message, not a
    // payload); only non-string `data` is capped.
    const data = isStringValue ? undefined : capLogData(redacted);

    const contextFields = readContextFields();

    return {
        ...(contextFields ?? {}),
        ts: new Date().toISOString(),
        level: level as LogLevelType,
        ...(category === undefined ? {} : { category }),
        ...(label === undefined ? {} : { label }),
        message: isStringValue ? (redacted as string) : (label ?? ''),
        ...(isStringValue ? {} : { data })
    };
}
