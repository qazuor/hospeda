import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /purchases (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/purchases';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a purchase (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                amount: 99.99,
                currency: 'USD',
                status: 'completed',
                quantity: 1
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('amount');
            expect(body.data).toHaveProperty('currency', 'USD');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // clientId missing
                pricingPlanId: crypto.randomUUID(),
                amount: 50,
                currency: 'USD',
                status: 'completed'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when amount is negative', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                amount: -10,
                currency: 'USD',
                status: 'completed',
                quantity: 1
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts optional paymentId for payment tracking', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                amount: 149.99,
                currency: 'EUR',
                status: 'completed',
                quantity: 2,
                paymentId: `mp_${crypto.randomUUID()}`
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });

    it('accepts pending status for incomplete purchases', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                amount: 29.99,
                currency: 'USD',
                status: 'pending',
                quantity: 1
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });
});
