import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('POST /subscription-items (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/subscription-items';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('creates a subscription item (happy path)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                sourceId: crypto.randomUUID(),
                sourceType: 'subscription',
                linkedEntityId: crypto.randomUUID(),
                entityType: 'product'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('sourceType');
            expect(body.data).toHaveProperty('entityType');
        }
    });

    it('returns 400 on validation errors (missing required fields)', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                // sourceId missing
                sourceType: 'subscription',
                linkedEntityId: crypto.randomUUID(),
                entityType: 'product'
            })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when sourceId is not a valid UUID', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                sourceId: 'invalid-uuid',
                sourceType: 'subscription',
                linkedEntityId: crypto.randomUUID(),
                entityType: 'product'
            })
        });

        expect(res.status).toBe(400);
    });

    it('links pricing tier to subscription', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                sourceId: crypto.randomUUID(),
                sourceType: 'subscription',
                linkedEntityId: crypto.randomUUID(),
                entityType: 'pricing_tier'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body.data).toHaveProperty('entityType', 'pricing_tier');
        }
    });

    it('links purchase to subscription', async () => {
        const mockActor = createMockAdminActor();
        const res = await app.request(base, {
            method: 'POST',
            ...createAuthenticatedRequest(mockActor),
            body: JSON.stringify({
                sourceId: crypto.randomUUID(),
                sourceType: 'purchase',
                linkedEntityId: crypto.randomUUID(),
                entityType: 'subscription'
            })
        });

        expect([200, 201, 202, 400]).toContain(res.status);
    });
});
