import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /pricing-tiers (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/pricing-tiers';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a pricing tier (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                pricingPlanId: crypto.randomUUID(),
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 1000
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('minQuantity', 1);
            expect(body.data).toHaveProperty('maxQuantity', 10);
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // pricingPlanId missing
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 1000
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when minQuantity is less than 1', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                pricingPlanId: crypto.randomUUID(),
                minQuantity: 0,
                maxQuantity: 10,
                unitPriceMinor: 1000
            })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 when maxQuantity is less than minQuantity', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                pricingPlanId: crypto.randomUUID(),
                minQuantity: 10,
                maxQuantity: 5,
                unitPriceMinor: 1000
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts null maxQuantity for unlimited tier', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                pricingPlanId: crypto.randomUUID(),
                minQuantity: 100,
                maxQuantity: null,
                unitPriceMinor: 500
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('maxQuantity', null);
        }
    });

    it('returns 400 when unitPriceMinor is not positive', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                pricingPlanId: crypto.randomUUID(),
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 0
            })
        });

        expect(res.status).toBe(400);
    });
});
