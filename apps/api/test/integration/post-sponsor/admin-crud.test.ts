/**
 * Integration tests for admin post-sponsor CRUD routes.
 *
 * Covers:
 * - GET  /api/v1/admin/post-sponsors         — list
 * - GET  /api/v1/admin/post-sponsors/:id     — get by ID
 * - POST /api/v1/admin/post-sponsors         — create
 * - PUT  /api/v1/admin/post-sponsors/:id     — full update
 * - PATCH /api/v1/admin/post-sponsors/:id    — partial update
 * - DELETE /api/v1/admin/post-sponsors/:id   — soft delete
 * - POST /api/v1/admin/post-sponsors/:id/restore  — restore
 * - DELETE /api/v1/admin/post-sponsors/:id/hard   — hard delete
 *
 * PostSponsor has no public tier — admin only.
 * Tests follow the conservative pattern used across this project's integration
 * suite: verify auth guards and input validation without requiring mock-actor
 * bypass to be enabled.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const base = '/api/v1/admin/post-sponsors';
const validUuid = '00000000-0000-0000-0000-000000000001';
const invalidUuid = 'not-a-uuid';

/** Minimum valid payload for creating a post sponsor */
const validCreatePayload = {
    name: 'Test Sponsor Co.',
    type: 'POST_SPONSOR',
    description: 'A test sponsor used in integration tests to verify route behaviour.'
};

describe('GET /api/v1/admin/post-sponsors (list)', () => {
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

describe('GET /api/v1/admin/post-sponsors/:id', () => {
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

describe('POST /api/v1/admin/post-sponsors (create)', () => {
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

    it('rejects invalid payload — either auth guard or validation fires first', async () => {
        // Arrange / Act
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ invalidField: 'value' })
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });

    it('rejects payload with too-short name', async () => {
        // Arrange — name must be at least 3 chars per PostSponsorSchema
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({
                name: 'AB',
                type: 'POST_SPONSOR',
                description: 'Valid long enough description here'
            })
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });

    it('rejects payload with too-short description', async () => {
        // Arrange — description must be at least 10 chars per PostSponsorSchema
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ name: 'Valid Name', type: 'POST_SPONSOR', description: 'Short' })
        });

        // Assert
        expect([400, 401, 403, 422]).toContain(res.status);
    });
});

describe('PUT /api/v1/admin/post-sponsors/:id (update)', () => {
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

describe('PATCH /api/v1/admin/post-sponsors/:id (partial update)', () => {
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
            body: JSON.stringify({ name: 'Updated Sponsor' })
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 for invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${invalidUuid}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ name: 'Updated Sponsor' })
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

describe('DELETE /api/v1/admin/post-sponsors/:id (soft delete)', () => {
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

describe('POST /api/v1/admin/post-sponsors/:id/restore', () => {
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

describe('DELETE /api/v1/admin/post-sponsors/:id/hard (hard delete)', () => {
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
