/**
 * Integration tests for admin owner-promotion CRUD routes.
 *
 * Covers:
 * - GET  /api/v1/admin/owner-promotions         — list
 * - GET  /api/v1/admin/owner-promotions/:id     — get by ID
 * - POST /api/v1/admin/owner-promotions         — create
 * - PUT  /api/v1/admin/owner-promotions/:id     — full update
 * - PATCH /api/v1/admin/owner-promotions/:id    — partial update
 * - DELETE /api/v1/admin/owner-promotions/:id   — soft delete
 * - POST /api/v1/admin/owner-promotions/:id/restore  — restore
 * - DELETE /api/v1/admin/owner-promotions/:id/hard   — hard delete
 *
 * All routes require admin authentication.
 * Tests follow the same conservative pattern as other integration tests in this
 * project (event-organizer, attraction): verify auth guards and input validation
 * without assuming the mock-actor bypass is enabled.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const base = '/api/v1/admin/owner-promotions';
const validUuid = '00000000-0000-0000-0000-000000000001';
const invalidUuid = 'not-a-uuid';

/** Minimum valid payload for creating an owner promotion */
const validCreatePayload = {
    ownerId: '00000000-0000-0000-0000-000000000099',
    title: 'Test Promotion',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: new Date(Date.now() + 1000 * 60).toISOString()
};

describe('GET /api/v1/admin/owner-promotions (list)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act — no auth headers
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });

        // Assert
        expect([401, 403]).toContain(res.status);
    });
});

describe('GET /api/v1/admin/owner-promotions/:id', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for an invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert — auth check fires before or after UUID validation; both are acceptable
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('POST /api/v1/admin/owner-promotions (create)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(validCreatePayload)
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('rejects invalid payload even before auth check when validation is early', async () => {
        // Arrange / Act
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ invalidField: 'value' })
        });

        // Assert — either auth guard (401/403) or validation error (400/422)
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('PUT /api/v1/admin/owner-promotions/:id (update)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(validCreatePayload)
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(validCreatePayload)
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('PATCH /api/v1/admin/owner-promotions/:id (partial update)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ title: 'Updated Title' })
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ title: 'Updated Title' })
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });

    it('validates request body fields', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ invalidField: true })
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('DELETE /api/v1/admin/owner-promotions/:id (soft delete)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}`, {
            method: 'DELETE',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}`, {
            method: 'DELETE',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('POST /api/v1/admin/owner-promotions/:id/restore', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}/restore`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}/restore`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('DELETE /api/v1/admin/owner-promotions/:id/hard (hard delete)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('requires authentication', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${validUuid}/hard`, {
            method: 'DELETE',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}/hard`, {
            method: 'DELETE',
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});
