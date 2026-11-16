/**
 * Analytics visitor attribution for POST /api/v1/protected/accommodations/import-from-url
 * (HOS-2119, T-072). The import service is mocked; the real app stack runs with the
 * mock-actor headers so the handler's `captureServerAnalyticsEvent` calls are observable.
 */

import type { AccommodationImportResponse } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSlidingWindowStore } from '../../../../src/middlewares/rate-limit';

const { mockDispatch, mockCapture } = vi.hoisted(() => ({
    mockDispatch: vi.fn(),
    mockCapture: vi.fn()
}));

vi.mock('../../../../src/lib/analytics-client', async (importActual) => ({
    ...(await importActual<typeof import('../../../../src/lib/analytics-client')>()),
    captureServerAnalyticsEvent: (...args: unknown[]) => mockCapture(...args)
}));
vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationImportService: vi.fn().mockImplementation(function () {
            return { dispatchImportFromUrl: mockDispatch };
        })
    };
});
vi.mock('../../../../src/services/mercadolibre-oauth/ml-token.service', () => ({
    getValidMercadoLibreToken: vi.fn(async () => 'token')
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async () => ({
            entitlements: { get: () => 1 },
            limits: { get: () => 10 }
        })
    })
}));
vi.mock('@repo/ai-core', async (importActual) => ({
    ...(await importActual<typeof import('@repo/ai-core')>()),
    getMonthlyCallCount: vi.fn(async () => 0),
    recordAiUsage: vi.fn(async () => undefined)
}));

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const ENDPOINT = '/api/v1/protected/accommodations/import-from-url';
const ACTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const NONE_RESPONSE: AccommodationImportResponse = {
    draft: {},
    source: 'none',
    methodsUsed: [],
    partial: true
};
const GENERIC_RESPONSE: AccommodationImportResponse = {
    draft: {},
    source: 'generic',
    methodsUsed: ['jsonld'],
    partial: false
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': 'HOST',
        'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE]),
        ...extra
    };
}

async function post(extra: Record<string, string>): Promise<Response> {
    return (await buildApp()).request(ENDPOINT, {
        method: 'POST',
        headers: headers(extra),
        body: JSON.stringify({ url: 'https://example.com/listing/1', legalConfirmed: true })
    });
}

let cachedApp: AppOpenAPI | undefined;
async function buildApp(): Promise<AppOpenAPI> {
    cachedApp ??= initApp();
    return cachedApp;
}

function eventCall(name: string): Record<string, unknown> | undefined {
    return mockCapture.mock.calls
        .map((c) => c[0] as Record<string, unknown>)
        .find((a) => a.name === name);
}

describe('import-from-url analytics visitor (HOS-2119 T-072)', () => {
    const VISITOR = { ip: '203.0.113.7', userAgent: 'UA/1' };
    const VISITOR_HEADERS = { 'cf-connecting-ip': VISITOR.ip, 'user-agent': VISITOR.userAgent };

    beforeEach(() => {
        clearSlidingWindowStore();
        mockCapture.mockClear();
        mockDispatch.mockReset();
    });

    it('passes the visitor on accommodation_import_started and _completed', async () => {
        mockDispatch.mockResolvedValue({ kind: 'sync', response: GENERIC_RESPONSE });

        const res = await post(VISITOR_HEADERS);

        expect(res.status).toBe(200);
        expect(eventCall('accommodation_import_started')).toMatchObject({
            distinctId: ACTOR_ID,
            visitor: VISITOR
        });
        expect(eventCall('accommodation_import_completed')).toMatchObject({ visitor: VISITOR });
    });

    it('passes the visitor on accommodation_import_failed', async () => {
        mockDispatch.mockResolvedValue({ kind: 'sync', response: NONE_RESPONSE });

        await post(VISITOR_HEADERS);

        expect(eventCall('accommodation_import_failed')).toMatchObject({ visitor: VISITOR });
    });

    it('passes the visitor on started when the import continues asynchronously (202)', async () => {
        mockDispatch.mockResolvedValue({
            kind: 'async',
            runId: 'run-1',
            datasetId: 'ds-1',
            source: 'airbnb',
            startedAt: '2026-07-02T09:20:00.000Z',
            url: 'https://www.airbnb.com/rooms/1'
        });

        const res = await post(VISITOR_HEADERS);

        expect(res.status).toBe(202);
        expect(eventCall('accommodation_import_started')).toMatchObject({ visitor: VISITOR });
    });

    it('omits the visitor when the ip header is absent', async () => {
        mockDispatch.mockResolvedValue({ kind: 'sync', response: GENERIC_RESPONSE });

        await post({ 'user-agent': 'UA/1' });

        expect(eventCall('accommodation_import_started')).toBeDefined();
        expect(eventCall('accommodation_import_started')).not.toHaveProperty('visitor');
        expect(eventCall('accommodation_import_completed')).not.toHaveProperty('visitor');
    });
});
