/**
 * Structured log entry shared by the NDJSON output path, the log hook registry
 * (sink + capture) and the `app_log_entries` DB sink. Having a single builder
 * guarantees those three consumers never diverge.
 *
 * @module logger/log-entry
 */

import { redactSensitiveData } from './redact.js';
import type { LogLevel, LogLevelType, LoggerOptions } from './types.js';

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
 * Build a structured {@link LogEntry} from raw log arguments.
 *
 * Positional signature mirrors `formatLogMessage` / `formatLogArgs` (its callers)
 * for consistency within the logger package. Applies sensitive-data redaction;
 * string values land in `message`, non-string values land in `data` (with
 * `message` falling back to the label or an empty string).
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

    return {
        ts: new Date().toISOString(),
        level: level as LogLevelType,
        ...(category !== undefined ? { category } : {}),
        ...(label !== undefined ? { label } : {}),
        message: isStringValue ? (redacted as string) : (label ?? ''),
        ...(isStringValue ? {} : { data: redacted })
    };
}
