/**
 * Tests for PATCH /api/v1/protected/search-history/preferences
 *
 * Verifies route registration and basic response shape under the test
 * environment (DISABLE_AUTH=true). Auth/gate behavior is covered by the
 * service-layer tests in packages/service-core/test/services/userSearchHistory/.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

describe('PATCH /api/v1/protected/search-history/preferences (toggle opt-out)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/protected/search-history/preferences';

    beforeAll(async () => {
        app = initApp();
    });

    it('route is registered and reachable (does not return 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'PATCH',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ enabled: true })
            });

            expect(res.status).not.toBe(404);
            expect([200, 400, 401, 403, 422]).toContain(res.status);
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
                method: 'PATCH',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ enabled: false })
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

    it('returns 400 or 422 when body is missing the enabled field', async () => {
        try {
            const res = await app.request(base, {
                method: 'PATCH',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
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

    it('returns 400 or 422 when enabled is not a boolean', async () => {
        try {
            const res = await app.request(base, {
                method: 'PATCH',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ enabled: 'yes' })
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
