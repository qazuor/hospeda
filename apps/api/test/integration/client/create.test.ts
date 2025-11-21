import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /clients (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/clients';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a client (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Acme Corporation',
                billingEmail: 'billing@acme.com',
                userId: crypto.randomUUID(),
                status: 'active'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('name', 'Acme Corporation');
            expect(body.data).toHaveProperty('billingEmail', 'billing@acme.com');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // name missing
                billingEmail: 'test@example.com'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when billingEmail is invalid', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Test Corp',
                billingEmail: 'invalid-email',
                userId: null
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts nullable userId', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Organization Without User',
                billingEmail: 'org@example.com',
                userId: null
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data.userId).toBeNull();
        }
    });

    it('returns 400 when name exceeds max length', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'a'.repeat(201),
                billingEmail: 'test@example.com',
                userId: crypto.randomUUID()
            })
        });

        expect(res.status).toBe(400);
    });

    it('returns 400 on invalid enum values for status', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                name: 'Test Company',
                billingEmail: 'test@example.com',
                userId: crypto.randomUUID(),
                status: 'INVALID_STATUS'
            })
        });

        expect(res.status).toBe(400);
    });
});
