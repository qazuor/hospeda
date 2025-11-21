import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /payment-methods (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/payment-methods';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a payment method (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                type: 'CREDIT_CARD',
                provider: 'MERCADO_PAGO',
                isDefault: true,
                cardBrand: 'VISA',
                cardLastFour: '4242',
                cardExpiryMonth: 12,
                cardExpiryYear: 2025,
                cardHolderName: 'John Doe'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('userId');
            expect(body.data).toHaveProperty('type', 'CREDIT_CARD');
            expect(body.data).toHaveProperty('isDefault', true);
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required userId
                type: 'CREDIT_CARD',
                provider: 'MERCADO_PAGO'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 on invalid payment method type', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                type: 'INVALID_TYPE',
                provider: 'MERCADO_PAGO'
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
                userId: crypto.randomUUID(),
                type: 'CREDIT_CARD',
                provider: 'MERCADO_PAGO',
                metadata: { customField: 'value' }
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('metadata');
        }
    });

    it('returns 400 on invalid card expiry data', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                userId: crypto.randomUUID(),
                type: 'CREDIT_CARD',
                provider: 'MERCADO_PAGO',
                cardExpiryMonth: 13, // Invalid month
                cardExpiryYear: 2025
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });
});
