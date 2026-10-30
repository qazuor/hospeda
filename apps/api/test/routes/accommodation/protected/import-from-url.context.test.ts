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

import type { AccommodationImportResponse } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { AccommodationImportService, type ImportContext } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDispatchImportFromUrl, mockGetValidMercadoLibreToken, gateState } = vi.hoisted(() => ({
    mockDispatchImportFromUrl: vi.fn(),
    mockGetValidMercadoLibreToken: vi.fn(async () => 'mock-ml-access-token'),
    gateState: { entitlement: true, limit: 10, count: 0 }
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationImportService: vi.fn().mockImplementation(function () {
            return {
                dispatchImportFromUrl: mockDispatchImportFromUrl
            };
        })
    };
});

vi.mock('../../../../src/services/mercadolibre-oauth/ml-token.service', () => ({
    getValidMercadoLibreToken: mockGetValidMercadoLibreToken
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async () => ({
            entitlements: { get: () => (gateState.entitlement ? 1 : undefined) },
            limits: { get: () => gateState.limit }
        })
    })
}));
vi.mock('@repo/ai-core', async (importActual) => ({
    ...(await importActual<typeof import('@repo/ai-core')>()),
    getMonthlyCallCount: vi.fn(async () => gateState.count),
    recordAiUsage: vi.fn(async () => undefined)
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

describe('TEST:V5:32 import-from-url ImportContext and quota degradation', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDispatchImportFromUrl.mockResolvedValue({ kind: 'sync', response: MINIMAL_RESPONSE });
        mockGetValidMercadoLibreToken.mockResolvedValue('mock-ml-access-token');
        gateState.entitlement = true;
        gateState.limit = 10;
        gateState.count = 0;
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

    it.each([
        ['missing entitlement', false, 10, 0, 'accommodation_import'],
        ['zero limit', true, 0, 0, 'accommodation_import'],
        ['exhausted quota', true, 10, 10, 'quota']
    ] as const)('degrades with a notice when the AI gate has %s', async (_case, entitled, limit, count, reason) => {
        gateState.entitlement = entitled;
        gateState.limit = limit;
        gateState.count = count;
        mockDispatchImportFromUrl.mockImplementation(
            async ({ context }: { context: ImportContext }) => {
                await context.aiExtract?.({ text: 'page', locale: 'es' });
                return { kind: 'sync', response: MINIMAL_RESPONSE };
            }
        );
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: AccommodationImportResponse };
        expect(body.data).toMatchObject({ draft: {}, source: 'none' });
        expect(body.data.message).toContain(
            reason === 'quota' ? 'límite mensual' : 'no está incluida'
        );
        expect(mockDispatchImportFromUrl).toHaveBeenCalledOnce();
    });

    it('constructs AccommodationImportService with exchange-rate deps wired (BETA-181)', async () => {
        // Act
        const res = await app.request(ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
        });

        // Assert
        expect(res.status).toBe(200);
        const MockedAccommodationImportService = vi.mocked(AccommodationImportService);
        expect(MockedAccommodationImportService).toHaveBeenCalledOnce();
        const [, deps] = MockedAccommodationImportService.mock.calls[0] as [
            unknown,
            { exchangeRateFetcher?: unknown; exchangeRateConfigService?: unknown }
        ];
        expect(deps.exchangeRateFetcher).toBeDefined();
        expect(deps.exchangeRateConfigService).toBeDefined();
    });
});
