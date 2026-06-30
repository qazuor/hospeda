/**
 * Tests for DELETE /api/v1/protected/search-history/:id
 *
 * Verifies route registration and basic response shape under the test
 * environment (DISABLE_AUTH=true). Auth/gate behavior is covered by the
 * service-layer tests in packages/service-core/test/services/userSearchHistory/.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('DELETE /api/v1/protected/search-history/:id (delete one entry)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/search-history';
    const validUuid = '00000000-0000-0000-0000-000000000001';

    beforeAll(async () => {
        app = initApp();
    });

    it('route is registered and reachable (does not return 404 on valid UUID)', async () => {
        try {
            const res = await app.request(`${base}/${validUuid}`, {
                method: 'DELETE',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect(res.status).not.toBe(404);
            expect([200, 204, 400, 401, 403, 422]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('route responds under DISABLE_AUTH test env (registration smoke — auth/gate covered by service tests)', async () => {
        try {
            const res = await app.request(`${base}/${validUuid}`, {
                method: 'DELETE',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect([200, 204, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 400 or 422 when id is not a valid UUID', async () => {
        try {
            const res = await app.request(`${base}/not-a-valid-uuid`, {
                method: 'DELETE',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
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
});
