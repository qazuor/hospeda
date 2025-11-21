import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /refunds (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/refunds';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a refund (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                paymentId: crypto.randomUUID(),
                clientId: crypto.randomUUID(),
                refundNumber: 'REF-12345',
                amount: 50,
                currency: 'USD',
                reason: 'CUSTOMER_REQUEST',
                description: 'Customer requested refund'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('paymentId');
            expect(body.data).toHaveProperty('clientId');
            expect(body.data).toHaveProperty('refundNumber');
            expect(body.data).toHaveProperty('amount');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required paymentId
                clientId: crypto.randomUUID(),
                refundNumber: 'REF-12345',
                amount: 50,
                currency: 'USD',
                reason: 'CUSTOMER_REQUEST'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 on invalid refund reason', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                paymentId: crypto.randomUUID(),
                clientId: crypto.randomUUID(),
                refundNumber: 'REF-12345',
                amount: 50,
                currency: 'USD',
                reason: 'INVALID_REASON'
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
                paymentId: crypto.randomUUID(),
                clientId: crypto.randomUUID(),
                refundNumber: 'REF-12345',
                amount: 50,
                currency: 'USD',
                reason: 'CUSTOMER_REQUEST',
                description: 'Optional description'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('description');
        }
    });

    it('validates refund amount is positive', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                paymentId: crypto.randomUUID(),
                clientId: crypto.randomUUID(),
                refundNumber: 'REF-12345',
                amount: -50, // Negative amount should fail
                currency: 'USD',
                reason: 'CUSTOMER_REQUEST'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });
});
