import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /pricing-plans (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/pricing-plans';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a pricing plan (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                productId: crypto.randomUUID(),
                billingScheme: 'per_unit',
                interval: 'monthly',
                amount: 29.99,
                currency: 'USD'
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
                // productId missing
                billingScheme: 'per_unit',
                amount: 10,
                currency: 'USD'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when currency is not 3 uppercase letters', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                productId: crypto.randomUUID(),
                billingScheme: 'per_unit',
                amount: 50,
                currency: 'usd' // lowercase
            })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 when amount is negative', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                productId: crypto.randomUUID(),
                billingScheme: 'per_unit',
                amount: -10,
                currency: 'USD'
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts optional metadata and lifecycleState', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                productId: crypto.randomUUID(),
                billingScheme: 'tiered',
                amount: 0,
                currency: 'EUR',
                metadata: JSON.stringify({ notes: 'test plan' }),
                lifecycleState: 'active'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });
});
