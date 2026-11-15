/**
 * Totality and collision tests of the Umami payload mapper (HOS-2119, T-018):
 * one bad property must never drop the whole event.
 */
import { describe, expect, it } from 'vitest';
import {
    mapToUmamiBatchItem,
    UMAMI_SYNTHETIC_IP,
    UMAMI_SYNTHETIC_USER_AGENT,
    UmamiBatchItemSchema
} from '../src/providers/umami-payload.js';

const base = {
    websiteId: '11111111-2222-4333-8444-555555555555',
    hostname: 'hospeda.com.ar'
} as const;

function map(properties: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return mapToUmamiBatchItem({ ...base, event: 'x', properties, ...extra } as never);
}

describe('mapToUmamiBatchItem totality', () => {
    it('should throw only for an empty or whitespace event name', () => {
        expect(() => mapToUmamiBatchItem({ ...base, event: '', properties: {} })).toThrow();
        expect(() => mapToUmamiBatchItem({ ...base, event: '   ', properties: {} })).toThrow();
    });

    it('should drop empty keys with a warning and keep the event', () => {
        const { item, warnings } = map({ '': 1, a: { '': 2, b: 3 }, ok: 4 });
        expect(item.payload.data).toEqual({ 'a.b': 3, ok: 4 });
        expect(warnings.filter((w) => w.includes('empty key'))).toHaveLength(2);
    });

    it('should drop an invalid Date (top level and in arrays) with a warning', () => {
        const bad = new Date('nope');
        const { item, warnings } = map({ d: bad, list: [bad, 'a'], ok: 1 });
        expect(item.payload.data).toEqual({ list: 'a', ok: 1 });
        expect(warnings).toHaveLength(2);
    });

    it('should keep valid Dates as ISO strings', () => {
        const { item } = map({ d: new Date('2026-11-15T10:00:00.000Z') });
        expect(item.payload.data['d']).toBe('2026-11-15T10:00:00.000Z');
    });

    it.each([
        ['empty ip', { ip: '', userAgent: 'Mozilla/5.0 X' }],
        ['whitespace ip', { ip: '  ', userAgent: 'Mozilla/5.0 X' }],
        ['empty userAgent', { ip: '203.0.113.9', userAgent: '' }]
    ])('should fall back to the synthetic identity per field with %s', (_label, visitor) => {
        const { item } = map({}, { visitor });
        expect(UmamiBatchItemSchema.safeParse(item).success).toBe(true);
        expect(item.payload.ip).toBe(visitor.ip.trim() ? visitor.ip : UMAMI_SYNTHETIC_IP);
        expect(item.payload.userAgent).toBe(
            visitor.userAgent ? visitor.userAgent : UMAMI_SYNTHETIC_USER_AGENT
        );
    });

    it('should fall back to the virtual url when url is empty', () => {
        const { item } = map({}, { url: '' });
        expect(item.payload.url).toBe('/_server/x');
    });

    it('should drop a cyclic object with a warning and keep siblings', () => {
        const a: Record<string, unknown> = { v: 1 };
        a['self'] = a;
        const { item, warnings } = map({ a, ok: 2 });
        expect(item.payload.data).toEqual({ 'a.v': 1, ok: 2 });
        expect(warnings.some((w) => w.includes('cyclic'))).toBe(true);
    });

    it('should accept the same object referenced twice (not a cycle)', () => {
        const shared = { v: 1 };
        const { item, warnings } = map({ a: shared, b: shared });
        expect(item.payload.data).toEqual({ 'a.v': 1, 'b.v': 1 });
        expect(warnings).toEqual([]);
    });

    it('should drop unsupported value types instead of "[object Object]"', () => {
        const { item, warnings } = map({ m: new Map(), f: () => 1, ok: 1 });
        expect(item.payload.data).toEqual({ ok: 1 });
        expect(warnings).toHaveLength(2);
    });
});

describe('mapToUmamiBatchItem key collisions and reserved keys', () => {
    it('should warn on a flatten collision and let the last value win', () => {
        const { item, warnings } = map({ 'a.b': 1, a: { b: 2 } });
        expect(item.payload.data).toEqual({ 'a.b': 2 });
        expect(warnings.some((w) => w.includes('collision'))).toBe(true);
    });

    it('should warn when two 501-char keys collide after truncation', () => {
        const { item, warnings } = map({ [`${'k'.repeat(500)}A`]: 1, [`${'k'.repeat(500)}B`]: 2 });
        expect(Object.keys(item.payload.data)).toHaveLength(1);
        expect(warnings.some((w) => w.includes('collision'))).toBe(true);
    });

    it('should skip prototype-polluting keys with a warning', () => {
        const props = JSON.parse('{"__proto__": 1, "constructor": 2, "prototype": 3, "ok": 4}');
        const { item, warnings } = map(props);
        expect(item.payload.data).toEqual({ ok: 4 });
        expect(Object.getPrototypeOf(item.payload.data)).toBe(Object.prototype);
        expect(warnings.filter((w) => w.includes('forbidden'))).toHaveLength(3);
    });

    it('should drop user_id and event_uuid properties so the mapper values win', () => {
        const { item, warnings } = map(
            { user_id: 'spoof', event_uuid: 'spoof', ok: 1 },
            { distinctId: 'real-user', uuid: 'real-uuid' }
        );
        expect(item.payload.data).toEqual({ ok: 1, user_id: 'real-user', event_uuid: 'real-uuid' });
        expect(warnings.filter((w) => w.includes('reserved'))).toHaveLength(2);
    });

    it('should drop reserved properties even with no mapper value', () => {
        const { item } = map({ user_id: 'spoof' });
        expect('user_id' in item.payload.data).toBe(false);
    });
});

describe('mapToUmamiBatchItem surrogates and arrays', () => {
    it('should not split a surrogate pair when truncating a value', () => {
        const value = `${'a'.repeat(499)}😀`;
        const { item } = map({ s: value });
        const out = item.payload.data['s'] as string;
        expect(out).toBe('a'.repeat(499));
        expect(out.charCodeAt(out.length - 1)).toBeLessThan(0xd800);
    });

    it('should not split a surrogate pair when truncating the event name', () => {
        const { item } = mapToUmamiBatchItem({
            ...base,
            event: `${'e'.repeat(49)}😀`,
            properties: {}
        });
        expect(item.payload.name).toBe('e'.repeat(49));
    });

    it('should drop object and NaN array entries with warnings', () => {
        const { item, warnings } = map({ list: ['a', { x: 1 }, Number.NaN, 2, null] });
        expect(item.payload.data['list']).toBe('a,2');
        expect(warnings).toHaveLength(2);
    });
});
