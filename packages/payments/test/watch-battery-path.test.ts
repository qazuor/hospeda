/**
 * HOS-1512 (M3): request paths are normalized against the provider origin, in the engine and in the
 * transport. Every bypass of the money-route check found in review is refused, and the bearer
 * token can never reach another host.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    createWatchTransport,
    type JsonValue,
    normalizeRequestPath,
    runWatchBattery,
    type WatchEntry,
    type WatchTransport
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const ORIGIN = 'https://api.mercadopago.test';
const BYPASSES = [
    '/v1/payments#x',
    '//v1/payments',
    '//evil.host/v1/payments',
    '/v1/%70ayments',
    '/v1/payments%2f..%2fx',
    '/./v1/payments',
    '/x/../v1/payments',
    '/v1/./payments',
    '/v1//payments',
    '/v1/payments/..',
    '@evil.host/v1/payments',
    '/@evil.host/v1/payments',
    'v1/payments',
    'https://evil.host/v1/payments',
    '/v1/payments\\x',
    '/v1/payments x',
    '/v1/payments\n',
    '/v1/payments?x=1#y'
] as const;

describe('normalizeRequestPath', () => {
    it.each(BYPASSES)('refuses %j', (path) => {
        expect(() => normalizeRequestPath({ path, origin: ORIGIN })).toThrow(
            /Request path refused/
        );
    });

    it('keeps a canonical path and its query, case as typed', () => {
        expect(normalizeRequestPath({ path: '/preapproval/abc-1_2', origin: ORIGIN })).toEqual({
            pathname: '/preapproval/abc-1_2',
            search: ''
        });
        expect(
            normalizeRequestPath({
                path: '/preapproval/search?payer_email=a%40b.test&limit=20',
                origin: ORIGIN
            })
        ).toEqual({ pathname: '/preapproval/search', search: '?payer_email=a%40b.test&limit=20' });
        expect(normalizeRequestPath({ path: '/V1/Payments', origin: ORIGIN }).pathname).toBe(
            '/V1/Payments'
        );
    });
});

describe('the transport never lets the token leave the provider origin', () => {
    it.each(BYPASSES)('refuses %j before any request is sent', async (path) => {
        const sent: string[] = [];
        const transport = createWatchTransport({
            baseUrl: ORIGIN,
            accessToken: 'fixture-credential',
            fetch: async (url) => {
                sent.push(String(url));
                return new Response('{}');
            }
        });
        await expect(transport({ method: 'POST', path })).rejects.toThrow(/Request path refused/);
        expect(sent).toEqual([]);
    });

    it('sends a canonical path to the configured origin only', async () => {
        const sent: string[] = [];
        const transport = createWatchTransport({
            baseUrl: `${ORIGIN}/`,
            accessToken: 'fixture-credential',
            fetch: async (url) => {
                sent.push(String(url));
                return new Response('{}');
            }
        });
        await transport({ method: 'GET', path: '/users/me' });
        expect(sent).toEqual([`${ORIGIN}/users/me`]);
    });
});

describe('the engine refuses every money-route bypass from a measurement that does not move money', () => {
    const NOW = new Date('2026-11-17T12:00:00.000Z');
    it.each(BYPASSES)('%j', async (path) => {
        const sent: string[] = [];
        const transport: WatchTransport = async (request) => {
            sent.push(`${request.method} ${request.path}`);
            return { status: 200, body: { id: 1, tags: ['test_user'] } };
        };
        const sneaky: WatchEntry = {
            id: 'RP8',
            accounts: ['sandbox'],
            effect: 'mutates',
            expected: 'x',
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({ label: 'x', request: { method: 'POST', path, body: {} } });
                return 'x';
            }
        };
        const store = memoryRunStore();
        const result = await runWatchBattery({
            account: 'sandbox',
            catalog: [sneaky],
            transport,
            authorization: null,
            clock: createAdjustableClock({ start: NOW }),
            ...store.ports
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PATH_REJECTED');
        expect(sent.filter((entry) => !entry.startsWith('GET'))).toEqual([]);
    });
});
