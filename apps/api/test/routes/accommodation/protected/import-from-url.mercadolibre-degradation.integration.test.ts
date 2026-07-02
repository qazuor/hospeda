/**
 * End-to-end integration test for the MercadoLibre OAuth degradation chain
 * (HOS-45 T-018).
 *
 * Proves the full failure chain works together now that all the pieces are
 * wired:
 *   1. `getValidMercadoLibreToken` (the OAuth token service) throws a
 *      terminal `MLTokenRefreshError`.
 *   2. `MercadoLibreAdapter.extract()` catches that thrown error via the
 *      `mercadoLibreTokenProvider` port and degrades — it does NOT rethrow
 *      and does NOT call the ML Items API.
 *   3. `AccommodationImportService.importFromUrl` propagates the adapter's
 *      `credentials_missing` failure code untouched.
 *   4. `POST /api/v1/protected/accommodations/import-from-url` surfaces that
 *      degradation in its response, matching the SPEC-258 C.1 failure-mode
 *      contract shape already used for other providers (e.g. Apify/Google
 *      Places `credentials_missing`) — see
 *      `apps/api/test/routes/accommodation-import.integration.test.ts` for
 *      the sibling full-route integration test this mirrors, and
 *      `import-from-url.context.test.ts` for the mercadoLibreTokenProvider
 *      port-wiring test this complements (that one mocks
 *      `AccommodationImportService` entirely; this one lets the real
 *      service + real `MercadoLibreAdapter.extract()` run so the
 *      port-catches-the-throw-and-degrades behaviour is genuinely exercised
 *      end-to-end).
 *
 * Only the token service is mocked. `AccommodationImportService` and
 * `MercadoLibreAdapter` are NOT mocked — their real logic runs. A MercadoLibre
 * URL is not a known short-link host, so `safeExternalFetch` is never invoked
 * on this path and does not need mocking either; the adapter returns before
 * ever calling `fetch()` against the ML Items API.
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetValidMercadoLibreToken } = vi.hoisted(() => ({
    mockGetValidMercadoLibreToken: vi.fn()
}));

vi.mock('../../../../src/services/mercadolibre-oauth/ml-token.service', () => ({
    getValidMercadoLibreToken: mockGetValidMercadoLibreToken
}));

import { MLTokenRefreshError } from '../../../../src/services/mercadolibre-oauth/ml-token.errors.js';

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';
const ML_URL = 'https://articulo.mercadolibre.com.ar/MLA-1234567890-cabana-frente-al-rio';

/** Auth headers for an authorized HOST with ACCOMMODATION_CREATE. */
function authHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE])
    };
}

describe('POST /api/v1/protected/accommodations/import-from-url — MercadoLibre OAuth degradation chain (HOS-45)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
    });

    it('degrades to credentials_missing when the OAuth token refresh fails terminally', async () => {
        // Arrange: getValidMercadoLibreToken throws an already-classified terminal
        // MLTokenRefreshError, as classifyMLRefreshFailure would produce for e.g.
        // an invalid_grant response from MercadoLibre.
        mockGetValidMercadoLibreToken.mockRejectedValue(
            new MLTokenRefreshError(
                'MercadoLibre rejected the refresh token (invalid_grant) — re-authorization required',
                'terminal'
            )
        );

        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: ML_URL, legalConfirmed: true })
        });

        // Assert: request still succeeds (200) — this is a degraded extraction,
        // not an HTTP-level error. Matches the SPEC-258 C.1 credentials_missing
        // contract shape used for other providers.
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: {
                source: string;
                partial: boolean;
                failureCode?: string;
                draft: Record<string, unknown>;
                methodsUsed: string[];
                message?: string;
            };
        };

        expect(body.success).toBe(true);
        expect(body.data.source).toBe('none');
        expect(body.data.partial).toBe(true);
        expect(body.data.failureCode).toBe('credentials_missing');
        expect(body.data.draft).toEqual({});
        expect(body.data.methodsUsed).toEqual([]);

        // Assert: the token provider was actually invoked (proves the adapter
        // called through the port rather than short-circuiting on a missing port).
        expect(mockGetValidMercadoLibreToken).toHaveBeenCalledOnce();
    });

    it('does not leak MercadoLibre/OAuth-specific internals in the degraded response', async () => {
        // Arrange
        mockGetValidMercadoLibreToken.mockRejectedValue(
            new MLTokenRefreshError(
                'MercadoLibre rejected the refresh token (invalid_grant) — re-authorization required',
                'terminal'
            )
        );

        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: ML_URL, legalConfirmed: true })
        });

        // Assert: the degraded response looks identical to any other
        // credentials_missing case (e.g. a missing Apify token) — no error
        // stack, no OAuth error text, no mention of refresh/access tokens.
        const body = (await res.json()) as { data: unknown };
        expect(body.data).not.toHaveProperty('message');

        const raw = JSON.stringify(body.data);
        expect(raw).not.toMatch(
            /MLTokenRefreshError|invalid_grant|refresh token|re-authorization|OAuth/i
        );
    });
});
