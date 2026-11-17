/**
 * @file canonical-json.ts
 * @description Deterministic JSON serialization used to hash write payloads
 * (HOS-2335 spec §5.2).
 *
 * Object keys are sorted recursively, so two payloads with the same values in a
 * different key order serialize identically. Array order is preserved (it is
 * meaningful). Keys whose value is `undefined` are dropped, exactly as
 * `JSON.stringify` does, so an omitted optional field and an explicit
 * `undefined` hash the same.
 */

/** A value that can be serialized as JSON. */
export type CanonicalJsonValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly CanonicalJsonValue[]
    | { readonly [key: string]: CanonicalJsonValue };

/**
 * Serializes a value to JSON with recursively sorted object keys.
 *
 * @param value - The value to serialize
 * @returns The canonical JSON text (`'null'` for a top-level `undefined`)
 *
 * @example
 * ```typescript
 * canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] }); // '{"a":[2,{"c":3,"d":4}],"b":1}'
 * ```
 */
export function canonicalJson(value: CanonicalJsonValue): string {
    if (value === undefined) {
        return 'null';
    }
    return serialize(value);
}

function serialize(value: CanonicalJsonValue): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => serialize(item === undefined ? null : item)).join(',')}]`;
    }
    const record = value as { readonly [key: string]: CanonicalJsonValue };
    const members = Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`);
    return `{${members.join(',')}}`;
}
