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

    describe('refuses ambiguous input', () => {
        it.each([
            ['NaN', Number.NaN],
            ['Infinity', Number.POSITIVE_INFINITY],
            ['-Infinity', Number.NEGATIVE_INFINITY],
            ['-0', -0],
            ['nested -0', { a: [-0] }]
        ])('throws on %s', (_label, value) => {
            expect(() => canonicalJson(value as never)).toThrow(TypeError);
        });

        it('keeps +0', () => {
            expect(canonicalJson(0)).toBe('0');
        });

        it.each([
            ['Date', new Date(0)],
            ['Map', new Map()],
            [
                'class instance',
                new (class Foo {
                    x = 1;
                })()
            ],
            ['toJSON object', Object.create({ toJSON: () => 1 })],
            ['bigint', 1n],
            ['function', () => 1],
            ['symbol', Symbol('s')],
            ['nested Date', { a: { b: new Date(0) } }]
        ])('throws on %s', (_label, value) => {
            expect(() => canonicalJson(value as never)).toThrow(TypeError);
        });

        it.each([
            ['bigint', 1n],
            ['function', () => 1],
            ['symbol', Symbol('s')]
        ])('reports %s as unsupported', (_label, value) => {
            expect(() => canonicalJson(value as never)).toThrow(/unsupported/);
        });

        it('throws on a sparse array hole', () => {
            // biome-ignore lint/suspicious/noSparseArray: the hole is the case under test
            expect(() => canonicalJson([1, , 3] as never)).toThrow(TypeError);
        });

        it('accepts null-prototype objects', () => {
            const o = Object.create(null) as Record<string, number>;
            o.b = 1;
            o.a = 2;
            expect(canonicalJson(o)).toBe('{"a":2,"b":1}');
        });
    });

    describe('strings', () => {
        it('handles unicode and distinguishes lone surrogates', () => {
            expect(canonicalJson({ t: 'ñ😀' })).toBe('{"t":"ñ😀"}');
            expect(canonicalJson('\ud800')).toBe('"\\ud800"');
            expect(canonicalJson('\ud800')).not.toBe(canonicalJson('\udc00'));
            expect(canonicalJson('\ud800')).not.toBe(canonicalJson('\ufffd'));
        });

        it('serializes undefined nested in an array as null', () => {
            expect(canonicalJson({ a: [undefined, 1] })).toBe('{"a":[null,1]}');
        });
    });
});
