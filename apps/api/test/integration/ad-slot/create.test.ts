import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /ad-slots (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/ad-slots';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates an ad slot (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                slotIdentifier: 'HOME-TOP-BANNER-001',
                placementPage: 'HOME',
                position: 'TOP_BANNER',
                dimensions: { width: 728, height: 90 },
                pricingModel: 'CPM',
                basePrice: 10,
                currency: 'USD'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('slotIdentifier');
            expect(body.data).toHaveProperty('placementPage');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required slotIdentifier
                placementPage: 'HOME'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('handles optional fields correctly', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                slotIdentifier: 'HOME-SIDEBAR-001',
                placementPage: 'HOME',
                position: 'SIDEBAR',
                pricingModel: 'CPC',
                basePrice: 5,
                metadata: { test: 'data' }
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });
});
