/**
 * HOS-2679 PR 2 — the Umami segment client: request shape, pagination, error
 * mapping, and that the key never leaks into an error.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    buildUmamiCampaignViewUrl,
    buildUmamiSegmentViewUrl,
    createUmamiSegmentsClient,
    UMAMI_SEGMENTS_PAGE_SIZE,
    UmamiSegmentsError
} from '../../src/lib/umami-segments-client';

const BASE = 'https://umami.test/';
const WEBSITE = '0f3c2a5e-1111-4222-8333-444455556666';
const KEY = 'umami_secret_key_value';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

function segment(id: string, name: string) {
    return { id, websiteId: WEBSITE, type: 'segment', name, parameters: { filters: [] } };
}

function clientWith(fetchImpl: typeof fetch, timeoutMs?: number) {
    return createUmamiSegmentsClient({
        baseUrl: BASE,
        websiteId: WEBSITE,
        apiKey: KEY,
        fetchImpl,
        ...(timeoutMs === undefined ? {} : { timeoutMs })
    });
}

describe('listSegments', () => {
    it('asks for type=segment with the search text and the bearer key', async () => {
        // Arrange
        const fetchMock = vi.fn(async () =>
            jsonResponse({ data: [segment('s1', 'QR · a')], count: 1, page: 1, pageSize: 100 })
        );

        // Act
        const rows = await clientWith(fetchMock as unknown as typeof fetch).listSegments({
            search: 'QR · '
        });

        // Assert
        expect(rows.map((row) => row.id)).toEqual(['s1']);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        const parsed = new URL(url);
        expect(parsed.origin + parsed.pathname).toBe(
            `https://umami.test/api/websites/${WEBSITE}/segments`
        );
        expect(parsed.searchParams.get('type')).toBe('segment');
        expect(parsed.searchParams.get('search')).toBe('QR · ');
        expect(parsed.searchParams.get('pageSize')).toBe(String(UMAMI_SEGMENTS_PAGE_SIZE));
        expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
        expect(init.method).toBe('GET');
    });

    it('follows count across pages', async () => {
        // Arrange
        const page1 = Array.from({ length: 100 }, (_, i) => segment(`a${i}`, `QR · ${i}`));
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ data: page1, count: 101 }))
            .mockResolvedValueOnce(jsonResponse({ data: [segment('last', 'QR · z')], count: 101 }));

        // Act
        const rows = await clientWith(fetchMock as unknown as typeof fetch).listSegments({
            search: 'QR · '
        });

        // Assert
        expect(rows).toHaveLength(101);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const secondUrl = new URL((fetchMock.mock.calls[1] as [string])[0]);
        expect(secondUrl.searchParams.get('page')).toBe('2');
    });

    it('accepts parameters stored as a JSON string', async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse({
                data: [{ id: 's1', type: 'segment', name: 'QR · a', parameters: '{"filters":[]}' }],
                count: 1
            })
        );

        const rows = await clientWith(fetchMock as unknown as typeof fetch).listSegments({
            search: 'x'
        });

        expect(rows[0]?.parameters).toEqual({ filters: [] });
    });
});

describe('createSegment', () => {
    it('posts the measured body shape', async () => {
        // Arrange
        const fetchMock = vi.fn(async () => jsonResponse(segment('new', 'QR · verano')));

        // Act
        const created = await clientWith(fetchMock as unknown as typeof fetch).createSegment({
            name: 'QR · verano',
            filters: [{ name: 'utmCampaign', operator: 'eq', value: 'verano' }]
        });

        // Assert
        expect(created.id).toBe('new');
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toStrictEqual({
            type: 'segment',
            name: 'QR · verano',
            parameters: { filters: [{ name: 'utmCampaign', operator: 'eq', value: 'verano' }] }
        });
    });
});

describe('errors', () => {
    it.each([401, 403])('maps %i to kind auth', async (status) => {
        const fetchMock = vi.fn(async () => jsonResponse({ error: 'no' }, status));

        const error = await clientWith(fetchMock as unknown as typeof fetch)
            .createSegment({ name: 'x', filters: [] })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(UmamiSegmentsError);
        expect((error as UmamiSegmentsError).kind).toBe('auth');
        expect((error as UmamiSegmentsError).status).toBe(status);
    });

    it('maps a 500 to kind http', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({}, 500));

        const error = await clientWith(fetchMock as unknown as typeof fetch)
            .listSegments({ search: 'x' })
            .catch((e: unknown) => e);

        expect((error as UmamiSegmentsError).kind).toBe('http');
    });

    it('maps a wrong shape to kind schema', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({ rows: [] }));

        const error = await clientWith(fetchMock as unknown as typeof fetch)
            .listSegments({ search: 'x' })
            .catch((e: unknown) => e);

        expect((error as UmamiSegmentsError).kind).toBe('schema');
    });

    it('maps a thrown fetch to kind network without the key in the message', async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error(`boom ${KEY}`);
        });

        const error = await clientWith(fetchMock as unknown as typeof fetch)
            .listSegments({ search: 'x' })
            .catch((e: unknown) => e);

        expect((error as UmamiSegmentsError).kind).toBe('network');
        expect((error as Error).message).not.toContain(KEY);
    });

    it('aborts after the timeout', async () => {
        // Arrange: a fetch that only settles when aborted.
        const fetchMock = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                })
        );

        // Act
        const error = await clientWith(fetchMock as unknown as typeof fetch, 5)
            .listSegments({ search: 'x' })
            .catch((e: unknown) => e);

        // Assert
        expect((error as UmamiSegmentsError).kind).toBe('timeout');
    });
});

describe('deep links', () => {
    it('builds the ad-hoc campaign filter link, encoded', () => {
        expect(
            buildUmamiCampaignViewUrl({
                baseUrl: BASE,
                websiteId: WEBSITE,
                campaign: 'verano 2026&x'
            })
        ).toBe(`https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano%202026%26x`);
    });

    it('builds the segment link', () => {
        expect(
            buildUmamiSegmentViewUrl({ baseUrl: BASE, websiteId: WEBSITE, segmentId: 's1' })
        ).toBe(`https://umami.test/websites/${WEBSITE}?segment=s1`);
    });
});
