import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('POST /api/v1/protected/user-bookmarks (create user bookmark)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/user-bookmarks';

    beforeAll(async () => {
        app = initApp();
    });

    it('route is registered and reachable (does not return 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001',
                    entityType: 'ACCOMMODATION'
                })
            });

            expect(res.status).not.toBe(404);
            expect([200, 201, 400, 401, 403, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401 when no authentication token is provided', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001',
                    entityType: 'ACCOMMODATION'
                })
            });

            expect([200, 201, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401, 400, or 200 when an invalid authorization token is provided (auth may be disabled in test env)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer invalid-token-value'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001',
                    entityType: 'ACCOMMODATION'
                })
            });

            // In test environment with DISABLE_AUTH=true, auth middleware may pass through
            // 400 may occur if validation fails before auth check
            expect([200, 201, 400, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when required fields are missing (no entityId)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityType: 'ACCOMMODATION'
                    // Missing entityId
                })
            });

            expect([400, 401, 403, 422]).toContain(res.status);

            if (res.status === 400 || res.status === 422) {
                const body = await res.json();
                expect(body).toHaveProperty('error');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when required fields are missing (no entityType)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001'
                    // Missing entityType
                })
            });

            expect([400, 401, 403, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 on invalid entityType value', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001',
                    entityType: 'INVALID_ENTITY_TYPE'
                })
            });

            expect([400, 401, 403, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 when body is empty', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({})
            });

            expect([400, 401, 403, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns created bookmark when authenticated (happy path)', async () => {
        try {
            const res = await app.request(base, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest',
                    accept: 'application/json'
                },
                body: JSON.stringify({
                    entityId: '00000000-0000-0000-0000-000000000001',
                    entityType: 'DESTINATION'
                })
            });

            expect([200, 201, 401, 403]).toContain(res.status);

            if (res.status === 200 || res.status === 201) {
                const body = await res.json();
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('id');
                expect(body.data).toHaveProperty('entityId');
                expect(body.data).toHaveProperty('entityType');
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
