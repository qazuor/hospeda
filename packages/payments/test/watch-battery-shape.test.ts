/** HOS-1512: the shape of a response and the comparison of two shapes. */
import { describe, expect, it } from 'vitest';
import { diffShapes, jsonEqual, shapeOf } from '../src/battery/index';

describe('shapeOf', () => {
    it('flattens objects and arrays into path -> types', () => {
        const shape = shapeOf({ body: { id: 'a', amount: 1, items: [{ x: 1 }, { x: 'y' }] } });
        expect(shape).toEqual({
            $: 'object',
            amount: 'number',
            id: 'string',
            items: 'array',
            'items[]': 'object',
            'items[].x': 'number|string'
        });
    });

    it('does not depend on how many array elements a response carries', () => {
        expect(shapeOf({ body: { items: [{ x: 1 }] } })).toEqual(
            shapeOf({ body: { items: [{ x: 2 }, { x: 3 }] } })
        );
    });

    it('marks a body that was not JSON', () => {
        expect(shapeOf({ body: undefined })).toEqual({ $: 'non-json' });
    });
});

describe('diffShapes', () => {
    const base = shapeOf({ body: { id: 'a', payer_email: 'x', n: 1 } });

    it('reports nothing when the shapes agree', () => {
        expect(diffShapes({ previous: base, current: base })).toEqual([]);
    });

    it('reports a renamed field as one removed and one added', () => {
        const renamed = shapeOf({ body: { id: 'a', payer_mail: 'x', n: 1 } });
        expect(diffShapes({ previous: base, current: renamed })).toEqual([
            'removed: payer_email (string)',
            'added: payer_mail (string)'
        ]);
    });

    it('reports a retyped field', () => {
        const retyped = shapeOf({ body: { id: 'a', payer_email: 'x', n: '1' } });
        expect(diffShapes({ previous: base, current: retyped })).toEqual([
            'retyped: n (number -> string)'
        ]);
    });

    it('does not count a field going between null and a concrete type as a change', () => {
        const withNull = shapeOf({ body: { id: 'a', payer_email: null, n: 1 } });
        expect(diffShapes({ previous: base, current: withNull })).toEqual([]);
        expect(diffShapes({ previous: withNull, current: base })).toEqual([]);
    });
});

describe('jsonEqual', () => {
    it('ignores key order and compares deeply', () => {
        expect(
            jsonEqual({ left: { a: 1, b: [1, { c: 2 }] }, right: { b: [1, { c: 2 }], a: 1 } })
        ).toBe(true);
    });

    it('tells different values, lengths, types and null apart', () => {
        expect(jsonEqual({ left: { a: 1 }, right: { a: 2 } })).toBe(false);
        expect(jsonEqual({ left: [1], right: [1, 2] })).toBe(false);
        expect(jsonEqual({ left: [1], right: { 0: 1 } })).toBe(false);
        expect(jsonEqual({ left: null, right: { a: 1 } })).toBe(false);
        expect(jsonEqual({ left: { a: 1 }, right: { b: 1 } })).toBe(false);
        expect(jsonEqual({ left: 'a', right: 1 })).toBe(false);
    });
});
