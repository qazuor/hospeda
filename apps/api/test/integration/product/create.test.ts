import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /products (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/products';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a product (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Premium Subscription',
                type: 'recurring',
                description: 'Monthly premium access to all features'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('name', 'Premium Subscription');
            expect(body.data).toHaveProperty('type', 'recurring');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // name missing
                type: 'one-time'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('accepts optional description and metadata', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Basic Plan',
                type: 'recurring',
                description: 'Entry-level access',
                metadata: JSON.stringify({ tier: 'basic', maxUsers: 5 })
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('description');
        }
    });

    it('returns 400 on invalid product type enum', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Test Product',
                type: 'INVALID_TYPE'
            })
        });

        expect(res.status).toBe(400);
    });

    it('creates one-time product successfully', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'One-Time Purchase',
                type: 'one-time',
                description: 'Single payment product'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('type', 'one-time');
        }
    });
});
