/**
 * Regression tests for the unchanged synchronous import contract (HOS-50 /
 * SPEC-277 R3 T-017).
 *
 * T-010 added a `202` async-dispatch branch to
 * `POST /api/v1/protected/accommodations/import-from-url`, taken ONLY when
 * the resolved adapter supports async extraction (Airbnb always; Booking
 * only on its Apify-fallback branch — see `accommodation-import-async.integration.test.ts`,
 * T-016). Every other source must be completely unaffected by that change.
 *
 * `accommodation-import.integration.test.ts` (T-021) already covers the
 * Generic/JSON-LD source at the full-route level. This file closes the
 * remaining gap: Google Places and MercadoLibre (neither implements
 * `extractAsync`, so `dispatchImportFromUrl` always takes the sync branch
 * for them) and Booking's JSON-LD-SUFFICIENT branch (the one case where
 * Booking itself still resolves synchronously, as opposed to T-016's
 * JSON-LD-sparse coverage). `import-from-url.dispatch.test.ts` only unit-tests
 * the pure response-shape-building function against a hand-built
 * `ImportDispatchResult` — it never exercises the real adapters or the
 * `supportsAsyncExtraction` routing, so it would NOT catch a regression that
 * accidentally sent one of these sources down the 202 branch.
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Force both credentials OFF regardless of the ambient shell/.env.local —
// the dev machine running this suite may have a real HOSPEDA_GOOGLE_PLACES_API_KEY
// set, which would otherwise fire a real, non-deterministic network call.
// NOTE: `= undefined` is NOT equivalent here — Node coerces it to the
// literal string "undefined" on process.env, which is truthy and would defeat
// the adapters' `!token` credential-missing check. An empty string is falsy
// and Zod's `.optional()` schema (no `.min(1)`) accepts it.
vi.hoisted(() => {
    process.env.HOSPEDA_GOOGLE_PLACES_API_KEY = '';
    process.env.HOSPEDA_MERCADOLIBRE_TOKEN = '';
});

vi.mock('@repo/utils/safe-fetch', async (importActual) => {
    const actual = await importActual<typeof import('@repo/utils/safe-fetch')>();
    return { ...actual, safeExternalFetch: vi.fn() };
});

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: () => ({ capture: vi.fn() })
}));

import { safeExternalFetch } from '@repo/utils/safe-fetch';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const mockFetch = vi.mocked(safeExternalFetch);

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';
const ACTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

/** Rich enough JSON-LD (name + description) to clear Booking's USEFUL_FIELD_THRESHOLD of 2. */
const RICH_JSONLD_HTML = `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Hotel Sol del Sur',
    description: 'Un hotel frente a la costanera.'
})}</script></head><body>Hotel Sol del Sur</body></html>`;

function fetchSuccess(html: string) {
    return {
        ok: true as const,
        status: 200,
        body: html,
        finalUrl: 'https://example.com/listing/1'
    };
}

async function postImport(url: string) {
    return app.request(ENDPOINT, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url, legalConfirmed: true })
    });
}

let app: AppOpenAPI;

describe('import-from-url sync-source regression contract (T-017)', () => {
    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Google Places: stays 200 (never 202) — no extractAsync on this adapter', async () => {
        // No HOSPEDA_GOOGLE_PLACES_API_KEY (forced off above) — the adapter
        // degrades to credentials_missing, which IS the unchanged pre-T-010
        // behavior for this source. finalizeImportDraft reports `source: 'none'`
        // whenever nothing was extracted (empty draft, no hints) — this is
        // shared, pre-existing behavior, not specific to this feature.
        const res = await postImport(
            'https://www.google.com/maps/place/Hotel+Sol/@-32.4878,-58.3626,17z'
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.source).toBe('none');
        expect(body.data.failureCode).toBe('credentials_missing');
        // Anti-regression: never the async-dispatch envelope shape.
        expect(body.data.runId).toBeUndefined();
        expect(body.data.datasetId).toBeUndefined();
    });

    it('MercadoLibre: stays 200 (never 202) — no extractAsync on this adapter', async () => {
        // No HOSPEDA_MERCADOLIBRE_TOKEN (forced off above) — same
        // credentials_missing + source:'none' degrade as Google Places above.
        const res = await postImport(
            'https://articulo.mercadolibre.com.ar/MLA-1234567890-cabana-en-alquiler'
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.source).toBe('none');
        expect(body.data.failureCode).toBe('credentials_missing');
        expect(body.data.runId).toBeUndefined();
        expect(body.data.datasetId).toBeUndefined();
    });

    it('Booking: JSON-LD-sufficient tier stays 200 (never 202) — no Apify run started', async () => {
        mockFetch.mockResolvedValue(fetchSuccess(RICH_JSONLD_HTML));

        const res = await postImport('https://www.booking.com/hotel/ar/sol-del-sur.html');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.source).toBe('booking');
        expect(body.data.methodsUsed).toContain('jsonld');
        expect(body.data.draft.name).toMatchObject({ value: 'Hotel Sol del Sur' });
        expect(body.data.runId).toBeUndefined();
        expect(body.data.datasetId).toBeUndefined();
        // Only the primary JSON-LD fetch — no Apify run, no fallback re-fetch.
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
