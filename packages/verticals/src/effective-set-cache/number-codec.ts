/** JSON-safe representation of a finite number or positive infinity. */
export function encodeFiniteOrInfinite(value: number): number | 'Infinity' {
    if (value === Number.POSITIVE_INFINITY) return 'Infinity';
    if (!Number.isFinite(value))
        throw new TypeError('Expected a finite number or positive infinity');
    return value;
}

/** Decodes a value produced by `encodeFiniteOrInfinite`, rejecting corrupt data. */
export function decodeFiniteOrInfinite(value: unknown): number {
    if (value === 'Infinity') return Number.POSITIVE_INFINITY;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    throw new TypeError('Invalid finite or infinite number');
}
