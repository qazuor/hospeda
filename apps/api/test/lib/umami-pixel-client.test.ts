/**
 * @file umami-pixel-client.test.ts
 * @description Unit tests for the Umami campaign pixel provisioner (HOS-2359 §6.B.2). Fetch is mocked.
 *
 * Measured on Umami 3.5.0 (M-1, M-4): a duplicate slug answers **500 with an empty
 * body** (not 409), a view-only key answers 401, and `GET /api/pixels?search=` is a
 * case-insensitive substring match over name and slug, scoped to the key's user.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createUmamiPixelProvisioner,
    UMAMI_PIXEL_TIMEOUT_MS
} from '../../src/lib/umami-pixel-client';
import { apiLogger } from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const KEY = 'umami_pixelsecret';
const SLUG = 'newsletter-otono-aaaaaaaa';
const PIXEL = {
    id: '459fe1e3-7cbb-475a-9be0-678bba0b1cef',
    name: 'Newsletter · Otoño',
    slug: SLUG,
    userId: '67fe8df0-7a85-4eb1-875d-5c2923d7972b',
    teamId: null
};

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const make = (fetchImpl: typeof fetch, overrides: { apiKey?: string; baseUrl?: string } = {}) =>
    createUmamiPixelProvisioner({
        baseUrl: 'https://pulso.test/',
        apiKey: KEY,
        fetchImpl,
        ...overrides
    });

const warnings = () => vi.mocked(apiLogger.warn).mock.calls.map(([arg]) => arg);

describe('createUmamiPixelProvisioner', () => {
    beforeEach(() => {
        vi.mocked(apiLogger.warn).mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates the pixel with POST /api/pixels and a bearer key (AC-10)', async () => {
        // Arrange
        const fetchImpl = vi.fn(async () => json(PIXEL));

        // Act
        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        // Assert
        expect(result).toEqual({ slug: SLUG });
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://pulso.test/api/pixels');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ name: PIXEL.name, slug: SLUG });
        expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
        expect(warnings()).toEqual([]);
    });

    it('reuses the existing pixel when the slug is taken: 500 then exact lookup (AC-12)', async () => {
        // Arrange
        const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            if (init?.method === 'POST') return new Response('', { status: 500 });
            const u = new URL(String(url));
            expect(u.pathname).toBe('/api/pixels');
            expect(u.searchParams.get('search')).toBe(SLUG);
            return json({
                data: [{ ...PIXEL, slug: `${SLUG}-other` }, PIXEL],
                count: 2,
                page: 1,
                pageSize: 100
            });
        });

        // Act
        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        // Assert: one POST, one GET, nothing else created
        expect(result).toEqual({ slug: SLUG });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
        expect(warnings()).toEqual([]);
    });

    it('answers null when the lookup only finds substring matches', async () => {
        const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
            init?.method === 'POST'
                ? new Response('', { status: 500 })
                : json({
                      data: [{ ...PIXEL, slug: `${SLUG}-x` }],
                      count: 1,
                      page: 1,
                      pageSize: 100
                  })
        );

        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        expect(result).toBeNull();
        expect(warnings()).toHaveLength(1);
        expect(warnings()[0]).toMatchObject({ kind: 'http', status: 500 });
    });

    it('does not look up on 401 (a view-only or wrong key) and warns once', async () => {
        const fetchImpl = vi.fn(async () => json({ error: { message: 'Unauthorized' } }, 401));

        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        expect(result).toBeNull();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(warnings()).toHaveLength(1);
        expect(warnings()[0]).toMatchObject({ kind: 'http', status: 401 });
    });

    it('answers null on a network error', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('fetch failed');
        });

        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        expect(result).toBeNull();
        expect(warnings()[0]).toMatchObject({ kind: 'network' });
    });

    it('answers null on a malformed success body', async () => {
        const fetchImpl = vi.fn(async () => json({ unexpected: true }));

        const result = await make(fetchImpl as typeof fetch)({ slug: SLUG, name: PIXEL.name });

        expect(result).toBeNull();
        expect(warnings()[0]).toMatchObject({ kind: 'schema' });
    });

    it(`gives up after ${UMAMI_PIXEL_TIMEOUT_MS}ms and answers null (AC-11)`, async () => {
        // Arrange: a fetch that only settles when aborted
        vi.useFakeTimers();
        const fetchImpl = vi.fn(
            (_url: string | URL | Request, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(new DOMException('aborted', 'AbortError'))
                    );
                })
        );

        // Act
        const pending = make(fetchImpl as unknown as typeof fetch)({
            slug: SLUG,
            name: PIXEL.name
        });
        await vi.advanceTimersByTimeAsync(UMAMI_PIXEL_TIMEOUT_MS);
        const result = await pending;

        // Assert
        expect(UMAMI_PIXEL_TIMEOUT_MS).toBe(3000);
        expect(result).toBeNull();
        expect(warnings()[0]).toMatchObject({ kind: 'timeout' });
    });

    it('answers null without any request when the key or URL is unset, warning once', async () => {
        const fetchImpl = vi.fn();
        const provision = make(fetchImpl as unknown as typeof fetch, { apiKey: '' });

        await expect(provision({ slug: SLUG, name: 'x' })).resolves.toBeNull();
        await expect(provision({ slug: SLUG, name: 'x' })).resolves.toBeNull();

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(warnings()).toHaveLength(1);
        expect(
            await make(fetchImpl as unknown as typeof fetch, { baseUrl: '' })({
                slug: SLUG,
                name: 'x'
            })
        ).toBeNull();
    });

    it('never writes the key in a log', async () => {
        const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
        const lookup503 = vi.fn(async () => new Response('nope', { status: 503 }));

        await make(fetchImpl as unknown as typeof fetch)({ slug: SLUG, name: 'x' });
        await make(lookup503 as unknown as typeof fetch)({ slug: SLUG, name: 'x' });

        expect(JSON.stringify(warnings())).not.toContain(KEY);
    });
});
