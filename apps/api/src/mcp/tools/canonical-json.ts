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
 *
 * Strict by design, because the output feeds a security binding: it THROWS a
 * {@link TypeError} on anything that could make two different payloads collide
 * or serialize ambiguously. That is non-finite numbers (`NaN`, `Infinity`
 * would both become `null`), `-0` (would become `0`), `bigint`, symbols,
 * functions, sparse array holes, and any object that is not a plain object
 * (`Date`, `Map`, class instances, `toJSON` objects). Convert such values
 * before hashing. Lone surrogates are safe: `JSON.stringify` escapes them.
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
 * @throws {TypeError} On any value the module doc lists as unsupported
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

function isPlainObject(value: object): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function serialize(value: CanonicalJsonValue): string {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError('canonicalJson: non-finite number');
        }
        if (Object.is(value, -0)) {
            throw new TypeError('canonicalJson: -0 is not allowed');
        }
        return JSON.stringify(value);
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return JSON.stringify(value);
    }
    if (typeof value !== 'object') {
        throw new TypeError(`canonicalJson: unsupported ${typeof value}`);
    }
    if (Array.isArray(value)) {
        const items: string[] = [];
        for (let i = 0; i < value.length; i++) {
            if (!(i in value)) {
                throw new TypeError('canonicalJson: sparse array hole');
            }
            const item = value[i];
            items.push(serialize(item === undefined ? null : item));
        }
        return `[${items.join(',')}]`;
    }
    if (!isPlainObject(value)) {
        throw new TypeError('canonicalJson: only plain objects, arrays and primitives');
    }
    const record = value as { readonly [key: string]: CanonicalJsonValue };
    const members = Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`);
    return `{${members.join(',')}}`;
}
