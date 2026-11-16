/**
 * Tests for the pure Umami payload mapper (HOS-2119, T-018).
 */
import { isbot } from 'isbot';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AnalyticsEventSchemas } from '../src/catalog.js';
import {
    mapToUmamiBatchItem,
    UMAMI_LIMITS,
    UMAMI_SYNTHETIC_IP,
    UMAMI_SYNTHETIC_USER_AGENT,
    UmamiBatchItemSchema
} from '../src/providers/umami-payload.js';
import { type AnalyticsGlobalProperties, prepareAnalyticsEvent } from '../src/shared.js';

const WEBSITE = '11111111-2222-4333-8444-555555555555';
const HOSTNAME = 'hospeda.com.ar';

const base = { websiteId: WEBSITE, hostname: HOSTNAME } as const;

type Def = Record<string, unknown> & { type: string };

/** Builds one schema-valid sample value by walking a Zod 4 schema. */
function sample(schema: z.ZodType, key: string): unknown {
    const node = schema as any;
    const def = node._zod.def as Def;
    switch (def.type) {
        case 'object': {
            const out: Record<string, unknown> = {};
            for (const [k, child] of Object.entries(node.shape as Record<string, z.ZodType>)) {
                out[k] = sample(child, k);
            }
            return out;
        }
        case 'optional':
        case 'default':
        case 'readonly':
        case 'nullable':
            return sample(def.innerType as z.ZodType, key);
        case 'enum':
            return Object.values(def.entries as Record<string, unknown>)[0];
        case 'literal':
            return (def.values as unknown[])[0];
        case 'boolean':
            return true;
        case 'array':
            return [sample(def.element as z.ZodType, key)];
        case 'union':
            return sample((def.options as z.ZodType[])[0] as z.ZodType, key);
        case 'number': {
            const min = typeof node.minValue === 'number' ? node.minValue : 0;
            const max = typeof node.maxValue === 'number' ? node.maxValue : 3;
            return Math.min(Math.max(min, 3), max);
        }
        case 'string': {
            if (node.format === 'uuid') return '9b2a56d8-3357-4f6f-9e32-95d4fcdfd2e9';
            if (node.format === 'datetime') return '2026-11-15T10:00:00.000Z';
            const max = typeof node.maxLength === 'number' ? node.maxLength : 64;
            const min = typeof node.minLength === 'number' ? node.minLength : 1;
            return `${key}_value`.slice(0, max).padEnd(min, 'x');
        }
        default:
            throw new Error(`Unsupported schema type in sample generator: ${def.type}`);
    }
}

/** Independent expectation of a scalar's mapped value (does not use the mapper). */
function expectedScalar(value: string | number | boolean): string | number {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return Math.round(value * 10000) / 10000;
    return value.length > 500 ? value.slice(0, 500) : value;
}

/**
 * Asserts that every non-null top-level property made it into `data`, either
 * as the key itself or as a `key.` prefix, and that scalars carry the mapped
 * value. Deliberately NOT computed with the production flatten.
 */
function expectParity(input: {
    properties: Record<string, unknown>;
    data: Record<string, string | number>;
}): void {
    const keys = Object.keys(input.data);
    for (const [key, value] of Object.entries(input.properties)) {
        if (value === null || value === undefined) continue;
        const present = keys.some((k) => k === key || k.startsWith(`${key}.`));
        expect(present, `property "${key}" is missing from data`).toBe(true);
        if (['string', 'number', 'boolean'].includes(typeof value)) {
            expect(input.data[key], `value of "${key}"`).toBe(
                expectedScalar(value as string | number | boolean)
            );
        } else if (Array.isArray(value)) {
            expect(input.data[key], `array "${key}"`).toBe(value.map(String).join(','));
        }
    }
}

const eventNames = Object.keys(AnalyticsEventSchemas) as (keyof typeof AnalyticsEventSchemas)[];

describe('mapToUmamiBatchItem', () => {
    describe('catalog parity (AC-2)', () => {
        it('should cover a non-empty catalog', () => {
            expect(eventNames.length).toBeGreaterThan(30);
        });

        it.each([
            'ai_chat_cap_reached',
            'ai_chat_message_sent',
            'ai_chat_opened'
        ] as const)('should prepare %s with messages_count (HOS-2119 T-024)', (name) => {
            // Arrange
            const properties = { accommodation_id: 'acc-1', locale: 'es', messages_count: 3 };

            // Act
            const prepared = prepareAnalyticsEvent({ name, properties });

            // Assert
            expect(prepared['messages_count']).toBe(3);
        });

        it.each(
            eventNames
        )('should prepare every catalog event without a forbidden key: %s', (name) => {
            const raw = sample(AnalyticsEventSchemas[name], name) as never;
            expect(() => prepareAnalyticsEvent({ name, properties: raw })).not.toThrow();
        });

        it.each(eventNames)('should map %s keeping name and every property', (name) => {
            // Arrange
            const raw = sample(AnalyticsEventSchemas[name], name) as never;
            const globalProperties: AnalyticsGlobalProperties = {
                app: 'api',
                environment: 'test',
                roles: ['HOST', 'ADMIN']
            };
            const properties = prepareAnalyticsEvent({ name, properties: raw, globalProperties });

            // Act
            const { item, warnings } = mapToUmamiBatchItem({
                ...base,
                event: name,
                properties
            });

            // Assert
            expect(warnings).toEqual([]);
            expect(UmamiBatchItemSchema.safeParse(item).success).toBe(true);
            expect(item.payload.name).toBe(name);
            expectParity({ properties, data: item.payload.data });
            expect(item.payload.data['app']).toBe('api');
            if (!('roles' in (raw as object))) {
                expect(item.payload.data['roles']).toBe('HOST,ADMIN');
            }
            for (const value of Object.values(item.payload.data)) {
                expect(['string', 'number']).toContain(typeof value);
            }
        });
    });

    describe('identity of the user (never payload.id)', () => {
        it('should never emit an id key, even with a real user id', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                distinctId: 'user-123'
            });
            expect(JSON.stringify(item)).not.toMatch(/"id"\s*:/);
            expect('id' in item.payload).toBe(false);
        });

        it('should put a real user id in data.user_id', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                distinctId: 'user-123'
            });
            expect(item.payload.data['user_id']).toBe('user-123');
        });

        it.each(['api-server', 'anon:abc', 'anon:'])('should drop distinct id %s', (distinctId) => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { a: 1 },
                distinctId
            });
            expect(item.payload.data).toEqual({ a: 1 });
            expect('id' in item.payload).toBe(false);
        });

        it('should not send user_id when distinctId is missing', () => {
            const { item } = mapToUmamiBatchItem({ ...base, event: 'x', properties: {} });
            expect('user_id' in item.payload.data).toBe(false);
        });
    });

    describe('event_uuid', () => {
        it('should map uuid to data.event_uuid', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                uuid: 'abc-uuid'
            });
            expect(item.payload.data['event_uuid']).toBe('abc-uuid');
        });
    });

    describe('visitor identity', () => {
        it('should use the visitor ip and user agent when provided', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                visitor: { ip: '203.0.113.9', userAgent: 'Mozilla/5.0 Test' }
            });
            expect(item.payload.ip).toBe('203.0.113.9');
            expect(item.payload.userAgent).toBe('Mozilla/5.0 Test');
        });

        it.each([
            ['Node.js/22 (undici)', 'Node.js/22 (undici)'],
            ['undici', 'undici'],
            ['curl', 'curl/8.5.0'],
            ['an api client', 'HospedaApiClient/2.0'],
            ['HospedaServer', 'HospedaServer/1.0']
        ])('should replace a bot-like visitor user agent (%s) with the synthetic one', (_l, ua) => {
            expect(isbot(ua)).toBe(true);
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                visitor: { ip: '203.0.113.9', userAgent: ua }
            });
            expect(item.payload.userAgent).toBe(UMAMI_SYNTHETIC_USER_AGENT);
            expect(item.payload.ip).toBe('203.0.113.9');
        });

        it('should keep a normal Chrome visitor user agent', () => {
            const chrome =
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                visitor: { ip: '203.0.113.9', userAgent: chrome }
            });
            expect(item.payload.userAgent).toBe(chrome);
        });

        it('should fall back to the synthetic identity without a visitor', () => {
            const { item } = mapToUmamiBatchItem({ ...base, event: 'x', properties: {} });
            expect(item.payload.ip).toBe('127.0.0.1');
            expect(UMAMI_SYNTHETIC_IP).toBe('127.0.0.1');
            expect(item.payload.userAgent).toBe(UMAMI_SYNTHETIC_USER_AGENT);
        });

        it('should use a synthetic user agent that Umami does not treat as a bot', () => {
            expect(UMAMI_SYNTHETIC_USER_AGENT).not.toMatch(
                /api|bot|crawl|spider|curl|node|server|https?:|compatible|headless|python|go-http|java/i
            );
            expect(UMAMI_SYNTHETIC_USER_AGENT).toMatch(/^Mozilla\/5\.0/);
        });

        it('should not be classified as a bot by isbot, the detector Umami uses', () => {
            // Umami 3.5.0 depends on isbot ^5.2.2 and drops bot traffic with HTTP 200.
            expect(isbot(UMAMI_SYNTHETIC_USER_AGENT)).toBe(false);
            // Control: the previous suffix was classified as a bot.
            expect(isbot(`${UMAMI_SYNTHETIC_USER_AGENT} HospedaServer/1.0`)).toBe(true);
        });

        it('should pin the exact synthetic user agent (isbot matched the old "Server" suffix)', () => {
            expect(UMAMI_SYNTHETIC_USER_AGENT).toBe(
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
            );
        });
    });

    describe('hostname and url', () => {
        it('should send the hostname and a virtual url by default', () => {
            const { item } = mapToUmamiBatchItem({ ...base, event: 'my_event', properties: {} });
            expect(item.payload.hostname).toBe(HOSTNAME);
            expect(item.payload.url).toBe('/_server/my_event');
            expect(item.payload.website).toBe(WEBSITE);
        });

        it('should keep the given url', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                url: '/es/alojamientos/'
            });
            expect(item.payload.url).toBe('/es/alojamientos/');
        });
    });

    describe('limits', () => {
        it('should export the measured limits', () => {
            expect(UMAMI_LIMITS).toMatchObject({
                eventName: 50,
                stringValue: 500,
                dataKey: 500,
                url: 500,
                hostname: 100
            });
        });

        it.each([
            [49, 49],
            [50, 50],
            [51, 50]
        ])('should truncate event name of %i chars to %i', (length, expected) => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'e'.repeat(length),
                properties: {}
            });
            expect(item.payload.name).toHaveLength(expected);
        });

        it.each([
            [499, 499],
            [500, 500],
            [501, 500]
        ])('should truncate string values of %i chars to %i', (length, expected) => {
            const { item, warnings } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { s: 'v'.repeat(length) }
            });
            expect(item.payload.data['s']).toHaveLength(expected);
            expect(warnings.length > 0).toBe(length > 500);
        });

        it.each([
            [499, 499],
            [500, 500],
            [501, 500]
        ])('should truncate data keys of %i chars to %i', (length, expected) => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { ['k'.repeat(length)]: 1 }
            });
            const keys = Object.keys(item.payload.data);
            expect(keys).toHaveLength(1);
            expect(keys[0]).toHaveLength(expected);
        });

        it.each([
            [499, 499],
            [500, 500],
            [501, 500]
        ])('should truncate url of %i chars to %i', (length, expected) => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                url: `/${'u'.repeat(length - 1)}`
            });
            expect(item.payload.url).toHaveLength(expected);
        });

        it.each([
            [99, 99],
            [100, 100],
            [101, 100]
        ])('should truncate hostname of %i chars to %i', (length, expected) => {
            const { item } = mapToUmamiBatchItem({
                websiteId: WEBSITE,
                hostname: 'h'.repeat(length),
                event: 'x',
                properties: {}
            });
            expect(item.payload.hostname).toHaveLength(expected);
        });
    });

    describe('numbers', () => {
        it('should round to 4 decimals', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { n: 1.23456789 }
            });
            expect(item.payload.data['n']).toBe(1.2346);
        });

        it('should drop |n| >= 1e15 with a warning and keep the rest', () => {
            const { item, warnings } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { big: 1e15, neg: -1e15, ok: 5 }
            });
            expect(item.payload.data).toEqual({ ok: 5 });
            expect(warnings).toHaveLength(2);
            expect(warnings.join(' ')).toContain('big');
        });

        it('should keep 1e15 - 1', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { n: 999999999999999 }
            });
            expect(item.payload.data['n']).toBe(999999999999999);
        });

        it('should drop non-finite numbers with a warning', () => {
            const { item, warnings } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { a: Number.NaN, b: Number.POSITIVE_INFINITY, ok: 1 }
            });
            expect(item.payload.data).toEqual({ ok: 1 });
            expect(warnings).toHaveLength(2);
        });
    });

    describe('flattening', () => {
        it('should flatten nested objects to dot keys', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { a: { b: { c: 'v' }, d: 2 } }
            });
            expect(item.payload.data).toEqual({ 'a.b.c': 'v', 'a.d': 2 });
        });

        it('should join arrays of primitives with commas', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { roles: ['HOST', 'ADMIN'], nums: [1, 2], empty: [] }
            });
            expect(item.payload.data['roles']).toBe('HOST,ADMIN');
            expect(item.payload.data['nums']).toBe('1,2');
            expect(item.payload.data['empty']).toBe('');
        });

        it('should stringify booleans explicitly', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { t: true, f: false }
            });
            expect(item.payload.data).toEqual({ t: 'true', f: 'false' });
        });

        it('should drop null and undefined values', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: { a: null, b: undefined, c: { d: null }, e: 'k' }
            });
            expect(item.payload.data).toEqual({ e: 'k' });
        });
    });

    describe('timestamp', () => {
        it('should convert a Date to unix seconds', () => {
            const { item } = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                timestamp: new Date('2026-11-15T10:00:00.900Z')
            });
            expect(item.payload.timestamp).toBe(Math.floor(Date.UTC(2026, 10, 15, 10) / 1000));
        });

        it('should accept ISO strings and epoch milliseconds', () => {
            const iso = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                timestamp: '2026-11-15T10:00:00.000Z'
            });
            const ms = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                timestamp: Date.UTC(2026, 10, 15, 10)
            });
            expect(iso.item.payload.timestamp).toBe(ms.item.payload.timestamp);
        });

        it('should omit the timestamp when absent or invalid', () => {
            const absent = mapToUmamiBatchItem({ ...base, event: 'x', properties: {} });
            const bad = mapToUmamiBatchItem({
                ...base,
                event: 'x',
                properties: {},
                timestamp: 'nope'
            });
            expect('timestamp' in absent.item.payload).toBe(false);
            expect('timestamp' in bad.item.payload).toBe(false);
            expect(bad.warnings).toHaveLength(1);
        });
    });

    describe('output schema', () => {
        it('should be accepted by the exported schema and reject malformed items', () => {
            const { item } = mapToUmamiBatchItem({ ...base, event: 'x', properties: { a: 1 } });
            expect(UmamiBatchItemSchema.safeParse(item).success).toBe(true);
            expect(item.type).toBe('event');
            expect(
                UmamiBatchItemSchema.safeParse({ ...item, payload: { ...item.payload, name: '' } })
                    .success
            ).toBe(false);
        });
    });
});
