/**
 * @file use-host-dashboard.test.ts
 * @description Unit tests for HostDashboardSchema Zod parse + error paths.
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so the test never hits the network.
 *
 * Coverage:
 * - Valid dashboard payload → passes schema parse
 * - plan=null variant → passes schema parse
 * - Missing required field → fails parse with path info
 * - Wrong type for numeric field → fails parse
 * - Invalid plan status → fails parse
 * - Error path via apiFetch: non-2xx → ApiError thrown
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiSchemaError } from '../errors';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports (Vitest hoisting)
// ---------------------------------------------------------------------------

vi.mock('../../auth-client', () => ({
    getCookie: vi.fn(() => '')
}));

vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: { apiUrl: 'http://test-api.local' }
        }
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { apiFetch } from '../client';
import { HostDashboardSchema } from './use-host-dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFetchResponse = (body: unknown, status = 200): Response => {
    const bodyStr = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse(bodyStr) as unknown,
        text: async () => bodyStr
    } as Response;
};

// ---------------------------------------------------------------------------
// Schema unit tests — no network required
// ---------------------------------------------------------------------------

describe('HostDashboardSchema', () => {
    const validPayload = {
        properties: { total: 5, published: 3, draft: 1, archived: 1 },
        plan: { slug: 'host-pro', name: 'Host Pro', status: 'active', isTrial: false },
        unreadConversations: 2
    };

    it('parses a complete valid payload', () => {
        const result = HostDashboardSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.properties.total).toBe(5);
            expect(result.data.plan?.slug).toBe('host-pro');
            expect(result.data.unreadConversations).toBe(2);
        }
    });

    it('parses when plan is null', () => {
        const payload = { ...validPayload, plan: null };
        const result = HostDashboardSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.plan).toBeNull();
        }
    });

    it('accepts all valid plan status values', () => {
        const statuses = ['active', 'trial', 'cancelled', 'expired', 'past_due'] as const;
        for (const status of statuses) {
            const result = HostDashboardSchema.safeParse({
                ...validPayload,
                plan: { ...validPayload.plan, status }
            });
            expect(result.success, `status=${status} should be valid`).toBe(true);
        }
    });

    it('fails when properties.total is missing', () => {
        const { total: _total, ...propertiesWithoutTotal } = validPayload.properties;
        const result = HostDashboardSchema.safeParse({
            ...validPayload,
            properties: propertiesWithoutTotal
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('properties.total');
        }
    });

    it('fails when unreadConversations is a string instead of number', () => {
        const result = HostDashboardSchema.safeParse({
            ...validPayload,
            unreadConversations: 'five'
        });
        expect(result.success).toBe(false);
    });

    it('fails when plan.status is an invalid value', () => {
        const result = HostDashboardSchema.safeParse({
            ...validPayload,
            plan: { ...validPayload.plan, status: 'unknown_status' }
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('plan.status');
        }
    });

    it('fails when plan.isTrial is not a boolean', () => {
        const result = HostDashboardSchema.safeParse({
            ...validPayload,
            plan: { ...validPayload.plan, isTrial: 'yes' }
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// apiFetch error path (network layer)
// ---------------------------------------------------------------------------

describe('apiFetch with host dashboard path — error handling', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('throws ApiError on 401 Unauthorized', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
                401
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/host/dashboard',
                schema: HostDashboardSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError on 403 Forbidden', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
                403
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/host/dashboard',
                schema: HostDashboardSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when server returns data with wrong shape', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({
                success: true,
                data: {
                    // Missing 'properties', 'plan', 'unreadConversations'
                    unexpected: 'field'
                }
            })
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/host/dashboard',
                schema: HostDashboardSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed data on valid 200 response', async () => {
        const validData = {
            properties: { total: 3, published: 2, draft: 1, archived: 0 },
            plan: { slug: 'host-basico', name: 'Host Básico', status: 'active', isTrial: false },
            unreadConversations: 0
        };

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: '/api/v1/protected/host/dashboard',
            schema: HostDashboardSchema
        });

        expect(data.properties.total).toBe(3);
        expect(data.plan?.name).toBe('Host Básico');
        expect(data.unreadConversations).toBe(0);
    });
});
