/**
 * Bounded structured-data serializer for the JSON/NDJSON log path.
 *
 * The PRETTY renderer (`formatter.formatValue`) already truncates and
 * depth-limits objects, but the JSON path (`log-entry.buildLogEntry`) used to
 * emit `data` verbatim. Because production and staging force JSON output, a
 * single unbounded `data` payload (e.g. a DB layer that logged an entire query
 * result) flooded the logs with megabytes per line.
 *
 * `capLogData` produces a bounded *structured* clone (still a plain
 * object/array, so the entry stays valid JSON) by enforcing hard ceilings on
 * depth, array length, object key count, string length and total node count.
 * It is a safety net: normal structured logs (a handful of small fields) pass
 * through byte-for-byte, while a runaway payload is clipped with explicit
 * `[+N more]` / `[Truncated ...]` markers so the operator can tell truncation
 * happened.
 *
 * @module logger/cap-data
 */

/**
 * Ceilings applied when bounding a structured `data` payload.
 */
export interface CapDataOptions {
    /** Maximum nesting depth kept before a value is replaced with a marker. */
    maxDepth: number;
    /** Maximum array elements kept; the rest collapse into one marker entry. */
    maxArrayItems: number;
    /** Maximum object keys kept; the rest collapse into one marker key. */
    maxObjectKeys: number;
    /** Maximum single-string length kept before truncation (characters). */
    maxStringLength: number;
    /** Maximum total number of values visited across the whole tree. */
    maxNodes: number;
    /**
     * Maximum total string characters kept across the whole tree. This is the
     * hard global size guard: even many medium strings cannot exceed it, so the
     * serialized entry stays bounded regardless of payload shape. A single long
     * string (e.g. an error stack) may still use up to `maxStringLength` while
     * budget remains.
     */
    maxTotalChars: number;
}

/**
 * Generous default ceilings. Chosen so ordinary structured logs are never
 * altered, while genuinely oversized payloads (full DB rows, huge arrays) are
 * bounded. These are a hard safety net, deliberately independent of the
 * PRETTY-only `TRUNCATE_LONG_TEXT_AT` display preference.
 */
export const DEFAULT_CAP_OPTIONS: CapDataOptions = {
    maxDepth: 6,
    maxArrayItems: 100,
    maxObjectKeys: 100,
    maxStringLength: 2000,
    maxNodes: 1000,
    maxTotalChars: 20_000
};

const TRUNCATED_PAYLOAD_MARKER = '[Truncated: log payload too large]';
const DEPTH_LIMIT_MARKER = '[Truncated: max depth reached]';
const CIRCULAR_MARKER = '[Circular]';

/**
 * Return a bounded structural clone of `value` suitable for JSON serialization.
 *
 * @param value - The (already redacted) value to bound
 * @param options - Optional ceiling overrides; defaults to {@link DEFAULT_CAP_OPTIONS}
 * @returns A depth/size-limited clone safe to `JSON.stringify`
 */
export function capLogData(value: unknown, options?: Partial<CapDataOptions>): unknown {
    const opts: CapDataOptions = { ...DEFAULT_CAP_OPTIONS, ...options };
    const seen = new WeakSet<object>();
    // Mutable budgets shared across the whole traversal.
    let remainingNodes = opts.maxNodes;
    let remainingChars = opts.maxTotalChars;

    const walk = (input: unknown, depth: number): unknown => {
        if (remainingNodes <= 0) {
            return TRUNCATED_PAYLOAD_MARKER;
        }
        remainingNodes -= 1;

        // Primitives and special scalars.
        if (input === null || input === undefined) {
            return input;
        }
        const type = typeof input;
        if (type === 'string') {
            const str = input as string;
            if (remainingChars <= 0) {
                return TRUNCATED_PAYLOAD_MARKER;
            }
            // Bound by both the per-string ceiling and the remaining global
            // character budget, whichever is smaller.
            const limit = Math.min(opts.maxStringLength, remainingChars);
            remainingChars -= Math.min(str.length, limit);
            return str.length > limit ? `${str.slice(0, limit)}…[+${str.length - limit}]` : str;
        }
        if (type === 'number' || type === 'boolean') {
            return input;
        }
        if (type === 'bigint') {
            // JSON.stringify throws on bigint — stringify defensively.
            return `${(input as bigint).toString()}n`;
        }
        if (type === 'function') {
            return '[Function]';
        }
        if (type === 'symbol') {
            return (input as symbol).toString();
        }

        // Objects and arrays from here on.
        if (depth >= opts.maxDepth) {
            return DEPTH_LIMIT_MARKER;
        }
        const obj = input as object;
        if (seen.has(obj)) {
            return CIRCULAR_MARKER;
        }
        seen.add(obj);

        if (Array.isArray(input)) {
            const kept = input.slice(0, opts.maxArrayItems).map((item) => walk(item, depth + 1));
            if (input.length > opts.maxArrayItems) {
                kept.push(`[+${input.length - opts.maxArrayItems} more]`);
            }
            return kept;
        }

        // Preserve Error objects in a readable, bounded shape.
        if (input instanceof Error) {
            return {
                name: input.name,
                message: walk(input.message, depth + 1),
                ...(input.stack === undefined ? {} : { stack: walk(input.stack, depth + 1) })
            };
        }

        const entries = Object.entries(input as Record<string, unknown>);
        const out: Record<string, unknown> = {};
        for (const [key, val] of entries.slice(0, opts.maxObjectKeys)) {
            if (remainingNodes <= 0) {
                out['…'] = TRUNCATED_PAYLOAD_MARKER;
                break;
            }
            out[key] = walk(val, depth + 1);
        }
        if (entries.length > opts.maxObjectKeys) {
            out['…'] = `[+${entries.length - opts.maxObjectKeys} more keys]`;
        }
        return out;
    };

    return walk(value, 0);
}
