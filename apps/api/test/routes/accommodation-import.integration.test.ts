/**
 * Integration tests for POST /api/v1/protected/accommodations/import-from-url
 * (SPEC-222 T-021).
 *
 * Exercises the full route → AccommodationImportService → GenericAdapter →
 * JSON-LD extractor → mapping → response path, with ONLY the network boundary
 * mocked (`safeExternalFetch`). The SSRF guard blocks localhost, so a real stub
 * server cannot be fetched — the fetch is mocked to return fixture HTML instead.
 *
 * Covered here (no AI / no rate-limit needed):
 *   - 200 with a partial draft carrying per-field confidence + source
 *   - reviews/ratings are NEVER present in the response (SPEC-222 hard rule)
 *   - legalConfirmed:false → 400 (schema rejects before the handler)
 *   - unauthenticated request → 401
 *
 * The lazy AI-gate branches are unit-tested in import-from-url.gate.test.ts;
 * the rate-limit 429 is in import-from-url.rate-limit.test.ts.
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }));

vi.mock('@repo/utils', async (importActual) => {
    const actual = await importActual<typeof import('@repo/utils')>();
    return { ...actual, safeExternalFetch: vi.fn() };
});

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: () => ({ capture: mockCapture })
}));

import { safeExternalFetch } from '@repo/utils';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const mockFetch = vi.mocked(safeExternalFetch);

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Auth headers for an authorized HOST with ACCOMMODATION_CREATE. */
function authHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE])
    };
}

/** A Hotel JSON-LD page WITH rating/review fields (which must be stripped). */
const RICH_JSONLD_HTML = `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Hotel Sol del Sur',
    description: 'Un hotel frente a la costanera.',
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'Av. Costanera 123',
        addressLocality: 'Concepción del Uruguay',
        addressCountry: 'AR'
    },
    geo: { '@type': 'GeoCoordinates', latitude: -32.484, longitude: -58.232 },
    telephone: '+54 3442 123456',
    image: ['https://cdn.example.com/1.jpg'],
    aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.7, reviewCount: 321 },
    review: [{ '@type': 'Review', reviewBody: 'Excelente lugar!' }],
    ratingValue: 4.7
})}</script></head><body>Hotel Sol del Sur</body></html>`;

function fetchSuccess(html: string) {
    return {
        ok: true as const,
        status: 200,
        body: html,
        finalUrl: 'https://example.com/listing/1'
    };
}

describe('POST /api/v1/protected/accommodations/import-from-url', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 with a partial draft carrying confidence + source from JSON-LD', async () => {
        // Arrange
        mockFetch.mockResolvedValue(fetchSuccess(RICH_JSONLD_HTML));

        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.source).toBe('generic');
        expect(body.data.partial).toBe(true);
        expect(body.data.methodsUsed).toContain('jsonld');
        expect(body.data.draft.name).toMatchObject({
            value: 'Hotel Sol del Sur',
            source: 'jsonld'
        });
        expect(typeof body.data.draft.name.confidence).toBe('number');
    });

    it('never includes reviews or ratings in the response', async () => {
        // Arrange
        mockFetch.mockResolvedValue(fetchSuccess(RICH_JSONLD_HTML));

        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert
        const raw = JSON.stringify(await res.json());
        expect(raw).not.toMatch(/aggregateRating|ratingValue|reviewBody|reviewCount/i);
        expect(raw).not.toContain('Excelente lugar');
        expect(raw).not.toContain('4.7');
    });

    it('rejects legalConfirmed:false with 400 (schema gate)', async () => {
        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: false })
        });

        // Assert
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it('emits ephemeral PostHog started + completed events on a successful import', async () => {
        // Arrange
        mockFetch.mockResolvedValue(fetchSuccess(RICH_JSONLD_HTML));

        // Act
        await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert: started + completed, only the hostname is sent (never the full URL).
        const events = mockCapture.mock.calls.map((call) => call[0].event);
        expect(events).toContain('accommodation_import_started');
        expect(events).toContain('accommodation_import_completed');
        const startedCall = mockCapture.mock.calls.find(
            (call) => call[0].event === 'accommodation_import_started'
        );
        expect(startedCall?.[0].properties.host).toBe('example.com');
    });

    it('returns 401 for an unauthenticated request', async () => {
        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'user-agent': 'vitest'
            },
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.success).toBe(false);
    });
});
