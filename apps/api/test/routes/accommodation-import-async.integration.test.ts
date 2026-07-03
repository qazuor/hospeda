/**
 * Integration tests for the full HOS-50 / SPEC-277 R3 async 202+poll route
 * contract (T-016).
 *
 * Exercises `POST /api/v1/protected/accommodations/import-from-url` (T-010)
 * and `GET .../import-from-url/status` (T-011) together, end-to-end through
 * `initApp()` + `app.request()`. Only the Apify HTTP boundary
 * (`startApifyRun`/`getApifyRunStatus`/`getApifyDatasetItems` in
 * `apify-client.ts`) and the SSRF-safe fetch boundary (`safeExternalFetch`)
 * are mocked — `resolveImportRunStatus`, `finalizeImportDraft`, and the
 * adapters themselves run for real, matching the pattern established by
 * `accommodation-import.integration.test.ts` (T-021) for the sync path.
 *
 * Covered:
 *   1. Airbnb: start -> poll running -> poll succeeded, returns a draft.
 *   2. Booking: JSON-LD-sparse primary tier -> async start -> succeeded.
 *   3. Poll-ceiling-exceeded -> failureCode 'timeout', asserting ZERO
 *      further Apify calls.
 *   4. Terminal FAILED -> 'provider_error' -> R2 Generic-adapter fallback
 *      SUCCEEDS (rich JSON-LD) -> returns a draft with the original source.
 *   5. Terminal FAILED -> 'provider_error' -> R2 fallback INSUFFICIENT
 *      (blocked fetch) -> surfaces the original failureCode.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
    process.env.HOSPEDA_APIFY_TOKEN = 'test-apify-token';
    process.env.HOSPEDA_APIFY_BOOKING_ACTOR = 'test/booking-actor';
});

vi.mock('@repo/utils/safe-fetch', async (importActual) => {
    const actual = await importActual<typeof import('@repo/utils/safe-fetch')>();
    return { ...actual, safeExternalFetch: vi.fn() };
});

vi.mock(
    '../../../../packages/service-core/src/services/accommodation-import/adapters/apify-client',
    () => ({
        runApifyActor: vi.fn(),
        startApifyRun: vi.fn(),
        getApifyRunStatus: vi.fn(),
        getApifyDatasetItems: vi.fn()
    })
);

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: () => ({ capture: vi.fn() })
}));

import { PermissionEnum } from '@repo/schemas';
import { safeExternalFetch } from '@repo/utils/safe-fetch';
import {
    getApifyDatasetItems,
    getApifyRunStatus,
    startApifyRun
} from '../../../../packages/service-core/src/services/accommodation-import/adapters/apify-client';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const mockFetch = vi.mocked(safeExternalFetch);
const mockStartApifyRun = vi.mocked(startApifyRun);
const mockGetApifyRunStatus = vi.mocked(getApifyRunStatus);
const mockGetApifyDatasetItems = vi.mocked(getApifyDatasetItems);

const POST_ENDPOINT = '/api/v1/protected/accommodations/import-from-url';
const STATUS_ENDPOINT = '/api/v1/protected/accommodations/import-from-url/status';
const ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

function fetchSuccess(html: string) {
    return {
        ok: true as const,
        status: 200,
        body: html,
        finalUrl: 'https://example.com/listing/1'
    };
}

const BLOCKED_FETCH = {
    ok: false as const,
    status: 0 as const,
    error: 'Blocked by SSRF policy',
    blocked: true as const
};

/** Rich JSON-LD page — enough for the R2 fallback to accept (name + description). */
const RICH_JSONLD_HTML = `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Hotel Sol del Sur',
    description: 'Un hotel frente a la costanera.'
})}</script></head><body>Hotel Sol del Sur</body></html>`;

/** No JSON-LD at all — Booking's primary tier yields 0 useful fields. */
const SPARSE_HTML =
    '<!doctype html><html><head><title>Listado</title></head><body>Sin datos estructurados.</body></html>';

describe('HOS-50 async 202+poll route contract (T-016)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Polls the status route with the given run handle (echoed back verbatim, per contract). */
    function getStatus(query: Record<string, string>) {
        const params = new URLSearchParams(query);
        return app.request(`${STATUS_ENDPOINT}?${params.toString()}`, {
            method: 'GET',
            headers: authHeaders()
        });
    }

    it('Airbnb: start -> poll running -> poll succeeded, returns a draft', async () => {
        const url = 'https://www.airbnb.com.ar/rooms/123456';
        mockStartApifyRun.mockResolvedValueOnce({
            runId: 'run-airbnb-1',
            defaultDatasetId: 'dataset-airbnb-1'
        });

        // Act: start the async run.
        const startRes = await app.request(POST_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url, legalConfirmed: true })
        });

        // Assert: 202 with the run handle shape.
        expect(startRes.status).toBe(202);
        const startBody = await startRes.json();
        expect(startBody.data).toMatchObject({
            runId: 'run-airbnb-1',
            datasetId: 'dataset-airbnb-1',
            source: 'airbnb',
            url
        });
        expect(typeof startBody.data.startedAt).toBe('string');
        const handle = startBody.data as Record<string, string>;

        // Act + Assert: poll #1 — still running, no dataset fetch yet.
        mockGetApifyRunStatus.mockResolvedValueOnce({
            status: 'RUNNING',
            defaultDatasetId: 'dataset-airbnb-1'
        });
        const runningRes = await getStatus(handle);
        expect(runningRes.status).toBe(200);
        const runningBody = await runningRes.json();
        expect(runningBody.data).toEqual({ settled: false });
        expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();

        // Act + Assert: poll #2 — succeeded, dataset mapped to a draft.
        mockGetApifyRunStatus.mockResolvedValueOnce({
            status: 'SUCCEEDED',
            defaultDatasetId: 'dataset-airbnb-1'
        });
        mockGetApifyDatasetItems.mockResolvedValueOnce([
            { name: 'Depto Airbnb Test', description: 'Lindo depto cerca del centro.' }
        ]);
        const succeededRes = await getStatus(handle);
        expect(succeededRes.status).toBe(200);
        const succeededBody = await succeededRes.json();
        expect(succeededBody.data.settled).toBe(true);
        expect(succeededBody.data.failureCode).toBeUndefined();
        expect(succeededBody.data.draft.source).toBe('airbnb');
        expect(succeededBody.data.draft.draft.name).toMatchObject({ value: 'Depto Airbnb Test' });
    });

    it('Booking: JSON-LD-sparse primary tier -> async start -> succeeded', async () => {
        const url = 'https://www.booking.com/hotel/ar/sol-del-sur.html';
        mockFetch.mockResolvedValueOnce(fetchSuccess(SPARSE_HTML));
        mockStartApifyRun.mockResolvedValueOnce({
            runId: 'run-booking-1',
            defaultDatasetId: 'dataset-booking-1'
        });

        // Act: start — primary JSON-LD tier is too sparse, falls through to Apify.
        const startRes = await app.request(POST_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url, legalConfirmed: true })
        });

        // Assert: 202, and the Apify async run was actually started (not a sync 200).
        expect(startRes.status).toBe(202);
        const startBody = await startRes.json();
        expect(startBody.data).toMatchObject({
            runId: 'run-booking-1',
            datasetId: 'dataset-booking-1',
            source: 'booking',
            url
        });
        expect(mockStartApifyRun).toHaveBeenCalledTimes(1);

        // Act + Assert: poll — succeeded, Booking dataset item mapped to a draft.
        mockGetApifyRunStatus.mockResolvedValueOnce({
            status: 'SUCCEEDED',
            defaultDatasetId: 'dataset-booking-1'
        });
        mockGetApifyDatasetItems.mockResolvedValueOnce([
            { name: 'Hotel Booking Test', description: 'Un hotel cerca de la playa.' }
        ]);
        const res = await getStatus(startBody.data as Record<string, string>);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.settled).toBe(true);
        expect(body.data.draft.source).toBe('booking');
        expect(body.data.draft.draft.name).toMatchObject({ value: 'Hotel Booking Test' });
    });

    it('poll-ceiling-exceeded returns failureCode "timeout" without a further Apify call', async () => {
        // Arrange: startedAt is further in the past than the default 120s ceiling.
        const staleStartedAt = new Date(Date.now() - 130_000).toISOString();

        // Act
        const res = await getStatus({
            runId: 'run-stale',
            datasetId: 'dataset-stale',
            source: 'airbnb',
            startedAt: staleStartedAt,
            url: 'https://www.airbnb.com.ar/rooms/999'
        });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ settled: true, failureCode: 'timeout' });
        expect(mockGetApifyRunStatus).not.toHaveBeenCalled();
        expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
    });

    it('FAILED -> provider_error -> R2 fallback SUCCEEDS, returns a draft with the original source', async () => {
        // Arrange
        const url = 'https://www.airbnb.com.ar/rooms/777';
        mockGetApifyRunStatus.mockResolvedValueOnce({
            status: 'FAILED',
            defaultDatasetId: 'dataset-failed-1'
        });
        mockFetch.mockResolvedValueOnce(fetchSuccess(RICH_JSONLD_HTML));

        // Act
        const res = await getStatus({
            runId: 'run-failed-1',
            datasetId: 'dataset-failed-1',
            source: 'airbnb',
            startedAt: new Date().toISOString(),
            url
        });

        // Assert: the fallback's structured extraction is accepted, and the
        // ORIGINAL source ('airbnb') is preserved — never 'generic'.
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.settled).toBe(true);
        expect(body.data.failureCode).toBeUndefined();
        expect(body.data.draft.source).toBe('airbnb');
        expect(body.data.draft.draft.name).toMatchObject({ value: 'Hotel Sol del Sur' });
        // The terminal-failure branch never re-fetches the dataset.
        expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
    });

    it('FAILED -> provider_error -> R2 fallback INSUFFICIENT, surfaces the original failureCode', async () => {
        // Arrange: the fallback fetch is blocked, so GenericAdapter yields nothing useful.
        mockGetApifyRunStatus.mockResolvedValueOnce({
            status: 'FAILED',
            defaultDatasetId: 'dataset-failed-2'
        });
        mockFetch.mockResolvedValueOnce(BLOCKED_FETCH);

        // Act
        const res = await getStatus({
            runId: 'run-failed-2',
            datasetId: 'dataset-failed-2',
            source: 'airbnb',
            startedAt: new Date().toISOString(),
            url: 'https://www.airbnb.com.ar/rooms/888'
        });

        // Assert: the original 'provider_error' failure code surfaces, no draft.
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ settled: true, failureCode: 'provider_error' });
    });
});
