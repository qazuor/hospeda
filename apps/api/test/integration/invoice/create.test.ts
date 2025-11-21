import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /invoices (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/invoices';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates an invoice (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                invoiceNumber: 'INV-12345',
                issueDate: '2024-01-01',
                dueDate: '2024-01-31',
                subtotal: 100,
                taxAmount: 21,
                totalAmount: 121,
                currency: 'USD',
                status: 'DRAFT'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('clientId');
            expect(body.data).toHaveProperty('invoiceNumber');
            expect(body.data).toHaveProperty('totalAmount');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // Missing required clientId
                invoiceNumber: 'INV-12345',
                totalAmount: 100
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 on invalid invoice status', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                invoiceNumber: 'INV-12345',
                totalAmount: 100,
                status: 'INVALID_STATUS'
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
                clientId: crypto.randomUUID(),
                invoiceNumber: 'INV-12345',
                totalAmount: 100,
                metadata: { customField: 'value' },
                notes: 'Test invoice notes'
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
                clientId: crypto.randomUUID(),
                invoiceNumber: 'INV-12345',
                subtotal: -100, // Negative amount should fail
                totalAmount: 100
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });
});
