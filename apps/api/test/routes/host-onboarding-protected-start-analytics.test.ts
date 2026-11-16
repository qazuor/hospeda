/**
 * Analytics for POST /api/v1/protected/host-onboarding/start (HOS-2119, T-072):
 * `onboarding_started` and `accommodation_draft_saved` carry the key properties and
 * the visitor IP/UA taken from the request headers. Mock strategy mirrors
 * `host-onboarding-protected-precheck.test.ts`.
 *
 * @module test/routes/host-onboarding-protected-start-analytics
 */
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateForOnboarding, mockCapture } = vi.hoisted(() => ({
    mockCreateForOnboarding: vi.fn(),
    mockCapture: vi.fn()
}));

vi.mock('../../src/lib/analytics-client', async (importActual) => ({
    ...(await importActual<typeof import('../../src/lib/analytics-client')>()),
    captureServerAnalyticsEvent: (...args: unknown[]) => mockCapture(...args)
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return { createForOnboarding: mockCreateForOnboarding };
        })
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const BASE_URL = '/api/v1/protected/host-onboarding/start';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

const BODY = {
    name: 'Cabana de prueba',
    summary: 'Una cabana de prueba para el onboarding.',
    type: 'CABIN',
    destinationId: DESTINATION_ID
};

function actorHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([] as PermissionEnum[]),
        ...extra
    };
}

describe('POST /api/v1/protected/host-onboarding/start analytics (HOS-2119 T-072)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockCreateForOnboarding.mockResolvedValue({
            data: {
                status: 'created',
                accommodation: { id: ACCOMMODATION_ID, slug: 'cabana-de-prueba' }
            },
            error: undefined
        });
    });

    it('captures onboarding_started and accommodation_draft_saved with the request visitor', async () => {
        const visitor = { ip: '203.0.113.7', userAgent: 'UA/1' };

        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders({
                'cf-connecting-ip': visitor.ip,
                'user-agent': visitor.userAgent
            }),
            body: JSON.stringify(BODY)
        });

        expect(res.status).toBeLessThan(300);
        expect(mockCapture).toHaveBeenCalledTimes(2);
        expect(mockCapture).toHaveBeenCalledWith({
            distinctId: ACTOR_ID,
            name: 'onboarding_started',
            properties: { onboarding_type: 'host_accommodation', draft_source: 'manual' },
            visitor
        });
        expect(mockCapture).toHaveBeenCalledWith({
            distinctId: ACTOR_ID,
            name: 'accommodation_draft_saved',
            properties: { accommodation_id: ACCOMMODATION_ID, creation_source: 'manual' },
            visitor
        });
    });

    it('omits the visitor when the ip header is absent', async () => {
        const res = await app.request(BASE_URL, {
            method: 'POST',
            headers: actorHeaders({ 'user-agent': 'UA/1' }),
            body: JSON.stringify(BODY)
        });

        expect(res.status).toBeLessThan(300);
        expect(mockCapture).toHaveBeenCalledTimes(2);
        for (const call of mockCapture.mock.calls) {
            expect(call[0]).not.toHaveProperty('visitor');
        }
    });
});
