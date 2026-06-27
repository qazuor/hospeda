/**
 * @file use-own-accommodations.test.ts
 * @description Unit tests for OwnAccommodationsListSchema Zod parse + apiFetch error paths.
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so the test never hits the network.
 *
 * Coverage:
 * - Valid list payload (with items + pagination) → passes schema parse
 * - Empty items array → passes schema parse
 * - Missing pagination field → fails parse
 * - Item with wrong field type → fails parse
 * - apiFetch error path: 401 → ApiError
 * - apiFetch error path: schema drift → ApiSchemaError
 * - apiFetch success: returns typed data
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiSchemaError } from '../errors';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
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
import { OwnAccommodationsListSchema } from './use-own-accommodations';

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

/**
 * Minimal AccommodationProtected item stub.
 * Only includes fields required by the schema to keep tests maintainable.
 */
/**
 * Valid UUIDs for test stubs (version 4).
 * Must use real UUIDs because AccommodationSchema.id uses z.string().uuid().
 */
const UUID_ACC = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_DEST = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const UUID_OWNER = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const makeAccommodationItem = (_suffix = '001') => ({
    id: UUID_ACC,
    slug: `test-slug-${_suffix}`,
    name: `Test Accommodation ${_suffix}`,
    type: 'HOTEL',
    summary: 'A short summary that meets the minimum length requirement.',
    description: 'A short description for testing purposes that meets the min length requirement.',
    isFeatured: false,
    destinationId: UUID_DEST,
    media: null,
    location: {
        address: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'AR',
        postalCode: '1234',
        latitude: -32.0,
        longitude: -58.0
    },
    averageRating: 0,
    reviewsCount: 0,
    visibility: 'PUBLIC',
    seo: null,
    price: null,
    tags: [],
    extraInfo: null,
    ownerId: UUID_OWNER,
    contactInfo: { mobilePhone: '+5411 12345678' },
    socialNetworks: null,
    lifecycleState: 'ACTIVE',
    faqs: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
});

const validPagination = {
    total: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1
};

// ---------------------------------------------------------------------------
// Schema unit tests
// ---------------------------------------------------------------------------

describe('OwnAccommodationsListSchema', () => {
    it('parses a valid list payload with one item', () => {
        const payload = {
            items: [makeAccommodationItem()],
            pagination: validPagination
        };
        const result = OwnAccommodationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.items).toHaveLength(1);
            expect(result.data.pagination.total).toBe(1);
        }
    });

    it('parses an empty items array', () => {
        const payload = { items: [], pagination: { ...validPagination, total: 0, totalPages: 0 } };
        const result = OwnAccommodationsListSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.items).toHaveLength(0);
        }
    });

    it('fails when pagination is missing', () => {
        const payload = { items: [] };
        const result = OwnAccommodationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('pagination');
        }
    });

    it('fails when pagination.total is not a number', () => {
        const payload = {
            items: [],
            pagination: { ...validPagination, total: 'many' }
        };
        const result = OwnAccommodationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });

    it('fails when items is not an array', () => {
        const payload = { items: 'not-an-array', pagination: validPagination };
        const result = OwnAccommodationsListSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// apiFetch error path (network layer)
// ---------------------------------------------------------------------------

describe('apiFetch with own accommodations path — error handling', () => {
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
                path: '/api/v1/protected/accommodations',
                query: { page: 1, pageSize: 12 },
                schema: OwnAccommodationsListSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiSchemaError when server returns unexpected data shape', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({
                success: true,
                data: { unexpected: true }
            })
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/accommodations',
                schema: OwnAccommodationsListSchema
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed data on a valid 200 response', async () => {
        const validData = {
            items: [makeAccommodationItem('xyz')],
            pagination: { total: 1, page: 1, pageSize: 12, totalPages: 1 }
        };

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: '/api/v1/protected/accommodations',
            schema: OwnAccommodationsListSchema
        });

        expect(data.items).toHaveLength(1);
        expect(data.items[0]?.id).toBe(UUID_ACC);
        expect(data.pagination.pageSize).toBe(12);
    });
});
