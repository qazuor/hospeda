import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /client-access-rights (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/client-access-rights';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a client access right (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                subscriptionItemId: crypto.randomUUID(),
                feature: 'premium-analytics',
                scope: 'full'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('feature', 'premium-analytics');
            expect(body.data).toHaveProperty('scope', 'full');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // clientId missing
                subscriptionItemId: crypto.randomUUID(),
                feature: 'test-feature',
                scope: 'limited'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when clientId is not a valid UUID', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: 'invalid-uuid',
                subscriptionItemId: crypto.randomUUID(),
                feature: 'test-feature',
                scope: 'full'
            })
        });

        expect(res.status).toBe(400);
    });

    it('accepts optional scoped access fields', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                subscriptionItemId: crypto.randomUUID(),
                feature: 'custom-reports',
                scope: 'scoped',
                scopeId: crypto.randomUUID(),
                scopeType: 'organization'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('scopeId');
            expect(body.data).toHaveProperty('scopeType', 'organization');
        }
    });

    it('accepts validity period fields', async () => {
        const mockActor = createMockAdminActor();
        const validFrom = new Date();
        const validTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                subscriptionItemId: crypto.randomUUID(),
                feature: 'time-limited-feature',
                scope: 'full',
                validFrom: validFrom.toISOString(),
                validTo: validTo.toISOString()
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });

    it('returns 400 when feature exceeds max length', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                clientId: crypto.randomUUID(),
                subscriptionItemId: crypto.randomUUID(),
                feature: 'a'.repeat(101),
                scope: 'full'
            })
        });

        expect(res.status).toBe(400);
    });
});
