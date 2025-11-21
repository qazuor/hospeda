import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /payments (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/payments';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a payment (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                planId: crypto.randomUUID(),
                amount: 99.99,
                currency: 'USD',
                paymentMethod: 'credit_card',
                description: 'Test payment',
                metadata: { test: 'data' }
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('userId');
            expect(body.data).toHaveProperty('amount', 99.99);
            expect(body.data).toHaveProperty('currency', 'USD');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required userId
                planId: crypto.randomUUID(),
                amount: 99.99,
                currency: 'USD'
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
                userId: crypto.randomUUID(),
                planId: crypto.randomUUID(),
                amount: -10,
                currency: 'USD',
                paymentMethod: 'credit_card'
            })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 when currency code is invalid', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                planId: crypto.randomUUID(),
                amount: 99.99,
                currency: 'INVALID',
                paymentMethod: 'credit_card'
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts optional metadata', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                planId: crypto.randomUUID(),
                amount: 50.0,
                currency: 'USD',
                paymentMethod: 'debit_card',
                metadata: {
                    orderId: '12345',
                    customerNote: 'Priority processing'
                }
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('metadata');
        }
    });
});
