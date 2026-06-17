/**
 * @file use-accommodation-view-stats.test.ts
 * @description Unit tests for AccommodationViewStatsListSchema Zod parse + error paths (SPEC-243 T-046).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so the test never hits the network.
 *
 * Coverage:
 * - Valid array payload → passes schema parse
 * - Empty array (no accommodations) → passes
 * - Zero-view entry (unique: 0, total: 0) → passes (server gap-fills)
 * - Missing required field (entityId) → fails parse
 * - Negative unique count → fails parse
 * - Non-integer total → fails parse
 * - Invalid UUID for entityId → fails parse
 * - apiFetch error path: non-2xx → ApiError thrown
 * - apiFetch schema error: wrong shape → ApiSchemaError thrown
 * - apiFetch happy path: valid 200 → typed data returned
 * - window query param forwarded: '7d' produces different queryKey than '30d'
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
import {
    AccommodationViewStatSchema,
    AccommodationViewStatsListSchema,
    accommodationViewStatsKeys
} from './use-accommodation-view-stats';

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

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

/** Builds a valid stats array for a given list of UUIDs. */
const makeStatsPayload = (entries: Array<{ entityId: string; unique: number; total: number }>) =>
    entries;

// ---------------------------------------------------------------------------
// AccommodationViewStatSchema — single item
// ---------------------------------------------------------------------------

describe('AccommodationViewStatSchema (single item)', () => {
    it('parses a valid entry with non-zero counts', () => {
        const result = AccommodationViewStatSchema.safeParse({
            entityId: VALID_UUID_1,
            unique: 42,
            total: 150
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.unique).toBe(42);
            expect(result.data.total).toBe(150);
        }
    });

    it('parses a zero-view entry (server gap-fill)', () => {
        const result = AccommodationViewStatSchema.safeParse({
            entityId: VALID_UUID_1,
            unique: 0,
            total: 0
        });
        expect(result.success).toBe(true);
    });

    it('fails when entityId is not a valid UUID', () => {
        const result = AccommodationViewStatSchema.safeParse({
            entityId: 'not-a-uuid',
            unique: 5,
            total: 10
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('entityId');
        }
    });

    it('fails when unique is negative', () => {
        const result = AccommodationViewStatSchema.safeParse({
            entityId: VALID_UUID_1,
            unique: -1,
            total: 5
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('unique');
        }
    });

    it('fails when total is not an integer', () => {
        const result = AccommodationViewStatSchema.safeParse({
            entityId: VALID_UUID_1,
            unique: 5,
            total: 10.5
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('total');
        }
    });

    it('fails when entityId is missing', () => {
        const result = AccommodationViewStatSchema.safeParse({
            unique: 5,
            total: 10
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('entityId');
        }
    });

    it('accepts total < unique (invariant not enforced by schema — deliberate)', () => {
        // The canonical schema documents `total >= unique` as a semantic invariant
        // but does NOT enforce it with `.refine()`, and the mobile schema mirrors that.
        // This test documents the deliberate non-enforcement to prevent a future
        // accidental `.refine()` from diverging with the server schema.
        const result = AccommodationViewStatSchema.safeParse({
            entityId: VALID_UUID_1,
            unique: 100,
            total: 5
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// AccommodationViewStatsListSchema — array
// ---------------------------------------------------------------------------

describe('AccommodationViewStatsListSchema (array)', () => {
    it('parses a valid non-empty array', () => {
        const payload = makeStatsPayload([
            { entityId: VALID_UUID_1, unique: 10, total: 30 },
            { entityId: VALID_UUID_2, unique: 5, total: 12 }
        ]);
        const result = AccommodationViewStatsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toHaveLength(2);
            expect(result.data[0]?.entityId).toBe(VALID_UUID_1);
        }
    });

    it('parses an empty array (host has no accommodations)', () => {
        const result = AccommodationViewStatsListSchema.safeParse([]);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toHaveLength(0);
        }
    });

    it('fails when an item in the array has a wrong field type', () => {
        const payload = [{ entityId: VALID_UUID_1, unique: 'ten', total: 30 }];
        const result = AccommodationViewStatsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });

    it('fails when the value is not an array', () => {
        const result = AccommodationViewStatsListSchema.safeParse({ entityId: VALID_UUID_1 });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// accommodationViewStatsKeys — query key factory
// ---------------------------------------------------------------------------

describe('accommodationViewStatsKeys', () => {
    it('produces different keys for 7d and 30d windows', () => {
        const key7d = accommodationViewStatsKeys.list('7d');
        const key30d = accommodationViewStatsKeys.list('30d');
        expect(JSON.stringify(key7d)).not.toBe(JSON.stringify(key30d));
    });

    it('includes the window value in the key', () => {
        const key = accommodationViewStatsKeys.list('7d');
        expect(JSON.stringify(key)).toContain('7d');
    });
});

// ---------------------------------------------------------------------------
// apiFetch error path (network layer)
// ---------------------------------------------------------------------------

describe('apiFetch with view-stats path — error handling', () => {
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
                path: '/api/v1/protected/views/accommodations/me',
                query: { window: '30d' },
                schema: AccommodationViewStatsListSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError on 403 Forbidden', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                { success: false, error: { code: 'FORBIDDEN', message: 'Entitlement required' } },
                403
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/views/accommodations/me',
                query: { window: '30d' },
                schema: AccommodationViewStatsListSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when server returns data with wrong shape', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({
                success: true,
                data: { unexpected: 'object instead of array' }
            })
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/views/accommodations/me',
                query: { window: '30d' },
                schema: AccommodationViewStatsListSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed array on valid 200 response', async () => {
        const validData = [
            { entityId: VALID_UUID_1, unique: 7, total: 20 },
            { entityId: VALID_UUID_2, unique: 3, total: 9 }
        ];

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: '/api/v1/protected/views/accommodations/me',
            query: { window: '30d' },
            schema: AccommodationViewStatsListSchema
        });

        expect(data).toHaveLength(2);
        expect(data[0]?.unique).toBe(7);
        expect(data[1]?.total).toBe(9);
    });

    it('returns empty array on valid 200 response with no accommodations', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse({ success: true, data: [] }));

        const { data } = await apiFetch({
            path: '/api/v1/protected/views/accommodations/me',
            query: { window: '7d' },
            schema: AccommodationViewStatsListSchema
        });

        expect(data).toHaveLength(0);
        expect(Array.isArray(data)).toBe(true);
    });
});
