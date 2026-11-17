/**
 * @file canonical-json.test.ts
 * @description Determinism of `canonicalJson` (HOS-2335 spec §5.2).
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../../src/mcp/tools/canonical-json';

describe('canonicalJson', () => {
    it('sorts object keys recursively', () => {
        expect(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe(
            '{"a":[2,{"c":3,"d":4}],"b":1}'
        );
    });

    it('is independent of key order', () => {
        expect(canonicalJson({ x: 1, y: { q: 1, p: 2 } })).toBe(
            canonicalJson({ y: { p: 2, q: 1 }, x: 1 })
        );
    });

    it('preserves array order', () => {
        expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    });

    it('drops undefined object members like JSON.stringify', () => {
        expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    });

    it('serializes primitives, null and nested undefined in arrays', () => {
        expect(canonicalJson('t"x')).toBe('"t\\"x"');
        expect(canonicalJson(null)).toBe('null');
        expect(canonicalJson(undefined)).toBe('null');
        expect(canonicalJson([1, undefined])).toBe('[1,null]');
    });

    it('distinguishes a string from a number', () => {
        expect(canonicalJson({ a: '1' })).not.toBe(canonicalJson({ a: 1 }));
    });
});
