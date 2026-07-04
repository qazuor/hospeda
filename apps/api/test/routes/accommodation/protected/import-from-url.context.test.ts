/**
 * Unit test for the `mercadoLibreTokenProvider` port wiring on the
 * import-from-url route (HOS-45 T-013).
 *
 * `AccommodationImportService` is mocked so the test can capture the exact
 * `ImportContext` object built by the handler, without exercising the real
 * extraction pipeline (already covered by `accommodation-import.integration.test.ts`).
 * `getValidMercadoLibreToken` is mocked so the test can prove the port
 * delegates to it without hitting the real OAuth token service.
 */

import { PermissionEnum } from '@repo/schemas';
import type { AccommodationImportResponse } from '@repo/schemas';
import type { ImportContext } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDispatchImportFromUrl, mockGetValidMercadoLibreToken } = vi.hoisted(() => ({
    mockDispatchImportFromUrl: vi.fn(),
    mockGetValidMercadoLibreToken: vi.fn(async () => 'mock-ml-access-token')
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationImportService: vi.fn().mockImplementation(() => ({
            dispatchImportFromUrl: mockDispatchImportFromUrl
        }))
    };
});

vi.mock('../../../../src/services/mercadolibre-oauth/ml-token.service', () => ({
    getValidMercadoLibreToken: mockGetValidMercadoLibreToken
}));

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';

/** Minimal valid response — schema-compliant graceful-degradation shape. */
const MINIMAL_RESPONSE: AccommodationImportResponse = {
    draft: {},
    source: 'none',
    methodsUsed: [],
    partial: true
};

function authHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE])
    };
}

describe('import-from-url ImportContext.mercadoLibreTokenProvider wiring', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDispatchImportFromUrl.mockResolvedValue({ kind: 'sync', response: MINIMAL_RESPONSE });
        mockGetValidMercadoLibreToken.mockResolvedValue('mock-ml-access-token');
        app = initApp();
    });

    it('builds a context carrying a working mercadoLibreTokenProvider', async () => {
        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert: request succeeded and the mocked service was invoked once.
        expect(res.status).toBe(200);
        expect(mockDispatchImportFromUrl).toHaveBeenCalledOnce();

        // Assert: the ImportContext passed to the service carries the port.
        const [{ context }] = mockDispatchImportFromUrl.mock.calls[0] as [
            { context: ImportContext }
        ];
        expect(typeof context.mercadoLibreTokenProvider).toBe('function');

        // Assert: calling the port delegates to getValidMercadoLibreToken.
        expect(mockGetValidMercadoLibreToken).not.toHaveBeenCalled();
        const token = await context.mercadoLibreTokenProvider?.();
        expect(token).toBe('mock-ml-access-token');
        expect(mockGetValidMercadoLibreToken).toHaveBeenCalledOnce();
    });
});
