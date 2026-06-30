/**
 * Tests for GET /api/v1/protected/search-history
 *
 * Verifies route registration and basic response shape under the test
 * environment (DISABLE_AUTH=true). Auth/gate behavior is covered by the
 * service-layer tests in packages/service-core/test/services/userSearchHistory/.
 * No DB required — services are mocked.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('GET /api/v1/protected/search-history (list search history)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/search-history';

    beforeAll(async () => {
        app = initApp();
    });

    it('route is registered and reachable (does not return 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // 404 means the route was never registered
            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403]).toContain(res.status);
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
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            expect([200, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('returns 401 or 200 with an invalid authorization token (auth may be disabled in test env)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    authorization: 'Bearer invalid-token-value'
                }
            });

            // In test environment with DISABLE_AUTH=true, auth middleware may pass through
            expect([200, 401, 403]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
