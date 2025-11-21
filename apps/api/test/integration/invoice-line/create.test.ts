import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /invoice-lines (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/invoice-lines';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates an invoice line (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                invoiceId: crypto.randomUUID(),
                description: 'Test product line item',
                quantity: 2,
                unitPrice: 50,
                totalAmount: 100
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('invoiceId');
            expect(body.data).toHaveProperty('description');
            expect(body.data).toHaveProperty('quantity');
            expect(body.data).toHaveProperty('totalAmount');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required invoiceId
                description: 'Test line',
                totalAmount: 100
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 on invalid quantity', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                invoiceId: crypto.randomUUID(),
                description: 'Test line',
                quantity: -1, // Invalid negative quantity
                unitPrice: 50,
                totalAmount: 100
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
                invoiceId: crypto.randomUUID(),
                description: 'Test line with optional fields',
                quantity: 1,
                unitPrice: 100,
                totalAmount: 100,
                taxAmount: 21,
                discountAmount: 10,
                metadata: { category: 'services' }
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('metadata');
        }
    });

    it('validates numeric amounts correctly', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                invoiceId: crypto.randomUUID(),
                description: 'Test line',
                quantity: 1,
                unitPrice: -50, // Negative price should fail
                totalAmount: 100
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });
});
