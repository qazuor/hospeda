import { describe, expect, it } from 'vitest';
import { capLogData } from '../src/cap-data.js';

describe('capLogData', () => {
    it('leaves a small object unchanged', () => {
        const value = { userId: 42, action: 'login', nested: { ok: true } };
        expect(capLogData(value)).toEqual(value);
    });

    it('leaves primitives unchanged', () => {
        expect(capLogData(7)).toBe(7);
        expect(capLogData(true)).toBe(true);
        expect(capLogData(null)).toBeNull();
        expect(capLogData(undefined)).toBeUndefined();
    });

    it('truncates a long array and appends a marker', () => {
        const arr = Array.from({ length: 250 }, (_, i) => i);
        const capped = capLogData(arr, { maxArrayItems: 10 }) as unknown[];
        expect(capped).toHaveLength(11);
        expect(capped[10]).toBe('[+240 more]');
    });

    it('truncates a long string and reports the dropped length', () => {
        const capped = capLogData('x'.repeat(50), { maxStringLength: 10 }) as string;
        expect(capped).toBe(`${'x'.repeat(10)}…[+40]`);
    });

    it('caps nesting depth with a marker', () => {
        const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };
        const capped = capLogData(deep, { maxDepth: 2 }) as Record<string, unknown>;
        // depth 0 = root, depth 1 = a, depth 2 hits the ceiling at b's value
        expect(JSON.stringify(capped)).toContain('[Truncated: max depth reached]');
    });

    it('collapses excess object keys into a marker key', () => {
        const obj: Record<string, number> = {};
        for (let i = 0; i < 20; i++) obj[`k${i}`] = i;
        const capped = capLogData(obj, { maxObjectKeys: 5 }) as Record<string, unknown>;
        expect(Object.keys(capped)).toHaveLength(6);
        expect(capped['…']).toBe('[+15 more keys]');
    });

    it('bounds total node count', () => {
        const wide = Array.from({ length: 100 }, (_, i) => ({ id: i }));
        const capped = capLogData(wide, { maxNodes: 10 });
        const serialized = JSON.stringify(capped);
        expect(serialized).toContain('[Truncated: log payload too large]');
    });

    it('handles circular references without throwing', () => {
        const a: Record<string, unknown> = { name: 'a' };
        a.self = a;
        const capped = capLogData(a) as Record<string, unknown>;
        expect(capped.self).toBe('[Circular]');
        // Result must be JSON-serializable.
        expect(() => JSON.stringify(capped)).not.toThrow();
    });

    it('serializes bigint defensively so JSON.stringify does not throw', () => {
        const capped = capLogData({ big: 10n });
        expect(() => JSON.stringify(capped)).not.toThrow();
        expect((capped as Record<string, unknown>).big).toBe('10n');
    });

    it('preserves Error objects as a readable bounded shape', () => {
        const capped = capLogData({ err: new Error('boom') }) as {
            err: { name: string; message: string };
        };
        expect(capped.err.name).toBe('Error');
        expect(capped.err.message).toBe('boom');
    });

    it('produces JSON-safe output for a realistic oversized DB-row dump', () => {
        const hugeRow = {
            items: Array.from({ length: 500 }, (_, i) => ({
                id: `id-${i}`,
                description: 'lorem '.repeat(500),
                nested: { a: { b: { c: { d: { e: { f: i } } } } } }
            })),
            total: 500
        };
        const serialized = JSON.stringify(capLogData(hugeRow));
        // The whole thing collapses well under the raw size.
        expect(serialized.length).toBeLessThan(50_000);
    });
});
