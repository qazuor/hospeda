/**
 * @file canonical-json.ts
 * @description Deterministic JSON for the committed help index (HOS-2410 spec
 * §5.2): object keys sorted, arrays in their given order, 2-space indent,
 * trailing newline. Two generations of the same content are byte-equal, which
 * is what guard (a) predicate a8 compares.
 */

/** A JSON value with every object's keys sorted, recursively. */
function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return Object.fromEntries(entries.map(([key, child]) => [key, sortKeys(child)]));
    }
    return value;
}

/**
 * Serializes a value as canonical JSON.
 *
 * @param args.value - Any JSON-compatible value
 * @returns The JSON text, keys sorted, 2-space indent, ending in a newline
 *
 * @example
 * ```ts
 * toCanonicalJson({ value: { b: 1, a: [2, 1] } }); // '{\n  "a": [\n    2,\n    1\n  ],\n  "b": 1\n}\n'
 * ```
 */
export function toCanonicalJson({ value }: { readonly value: unknown }): string {
    return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
