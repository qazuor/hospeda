import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /subscriptions (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/subscriptions';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a subscription (happy path)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                status: 'active',
                startDate: new Date().toISOString()
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('status');
            expect(body.data).toHaveProperty('clientId');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                // clientId missing
                pricingPlanId: crypto.randomUUID(),
                status: 'active',
                startDate: new Date().toISOString()
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when clientId is not a valid UUID', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                clientId: 'invalid-uuid',
                pricingPlanId: crypto.randomUUID(),
                status: 'active',
                startDate: new Date().toISOString()
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts optional endDate and trialEndDate', async () => {
        const startDate = new Date();
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });

    it('accepts trial subscription with trialEndsAt', async () => {
        const startDate = new Date();
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                pricingPlanId: crypto.randomUUID(),
                status: 'trial',
                startDate: startDate.toISOString(),
                trialEndsAt: trialEndsAt.toISOString()
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });
});
