/**
 * @file use-patch-accommodation.test.ts
 * @description Unit tests for AccommodationOperationalUpdateSchema Zod validation
 * and the patch mutation body transform/validation logic.
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so tests never hit the network.
 *
 * Coverage:
 * - AccommodationOperationalUpdateSchema: all fields optional (empty body valid)
 * - AccommodationOperationalUpdateSchema: valid URL fields pass
 * - AccommodationOperationalUpdateSchema: invalid URL rejects with path info
 * - AccommodationOperationalUpdateSchema: invalid email rejects
 * - AccommodationOperationalUpdateSchema: summary too short/long rejects
 * - apiFetch PATCH success path → returns AccommodationProtected-shaped data
 * - apiFetch PATCH error path → ApiError on 403
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';

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

import { AccommodationProtectedSchema } from '@repo/schemas';
import { apiFetch } from '../client';
import { AccommodationOperationalUpdateSchema } from './use-patch-accommodation';

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
 * Valid UUIDs for test stubs (version 4).
 */
const UUID_ACC = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const UUID_DEST = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const UUID_OWNER = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Minimal AccommodationProtected stub for PATCH response.
 * Uses valid UUIDs and E.164 phone because AccommodationProtectedSchema
 * enforces uuid() on id/destinationId/ownerId and regex on mobilePhone.
 */
const makeAccommodationProtected = () => ({
    id: UUID_ACC,
    slug: 'test-slug',
    name: 'Test Accommodation',
    type: 'HOTEL',
    summary: 'Brief summary text here',
    description:
        'A description that is long enough to pass the min length requirement for this field.',
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

// ---------------------------------------------------------------------------
// Schema unit tests
// ---------------------------------------------------------------------------

describe('AccommodationOperationalUpdateSchema', () => {
    it('passes with an empty body (all fields optional)', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('passes with a valid phone string', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            phone: '+54 11 1234-5678'
        });
        expect(result.success).toBe(true);
    });

    it('passes with a valid email address', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            email: 'contact@example.com'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid email address', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            email: 'not-an-email'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('email');
        }
    });

    it('passes with valid URLs for social fields', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            twitter: 'https://x.com/hospeda',
            facebook: 'https://facebook.com/hospeda',
            instagram: 'https://instagram.com/hospeda'
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid URL for twitter', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            twitter: 'not-a-url'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('twitter');
        }
    });

    it('rejects a summary shorter than 10 characters', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            summary: 'Short'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('summary');
        }
    });

    it('rejects a summary longer than 300 characters', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            summary: 'A'.repeat(301)
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('summary');
        }
    });

    it('passes with a summary in the valid range (10–300 chars)', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            summary: 'A summary that has exactly enough characters to be valid.'
        });
        expect(result.success).toBe(true);
    });

    it('allows all operational fields at once', () => {
        const result = AccommodationOperationalUpdateSchema.safeParse({
            phone: '+54 11 9999-8888',
            email: 'host@example.com',
            website: 'https://myplace.com',
            twitter: 'https://x.com/myplace',
            facebook: 'https://facebook.com/myplace',
            instagram: 'https://instagram.com/myplace',
            linkedin: 'https://linkedin.com/in/myplace',
            tiktok: 'https://tiktok.com/@myplace',
            youtube: 'https://youtube.com/myplace',
            summary: 'A nice short summary about the property.',
            description:
                'A longer description that has enough characters to meet the minimum requirement for this field.'
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// apiFetch PATCH error and success paths
// ---------------------------------------------------------------------------

describe('apiFetch PATCH accommodation — error and success', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('throws ApiError on 403 Forbidden (entitlement not met)', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                {
                    success: false,
                    error: { code: 'ENTITLEMENT_REQUIRED', message: 'Upgrade required' }
                },
                403
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/accommodations/acc-001',
                method: 'PATCH',
                body: { phone: '+54 11 1234-5678' },
                schema: AccommodationProtectedSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError on 404 Not Found (not owned)', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
                },
                404
            )
        );

        await expect(
            apiFetch({
                path: '/api/v1/protected/accommodations/acc-not-mine',
                method: 'PATCH',
                body: {},
                schema: AccommodationProtectedSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('returns updated accommodation on successful PATCH', async () => {
        const updatedAccomm = makeAccommodationProtected();
        updatedAccomm.contactInfo = { mobilePhone: '+5411 99990000' };

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: updatedAccomm })
        );

        const { data } = await apiFetch({
            path: `/api/v1/protected/accommodations/${UUID_ACC}`,
            method: 'PATCH',
            body: { phone: '+5411 99990000' },
            schema: AccommodationProtectedSchema
        });

        expect(data.id).toBe(UUID_ACC);
        expect(data.contactInfo?.mobilePhone).toBe('+5411 99990000');
    });

    it('omits cleared optional fields from the PATCH body (v1 clear-is-no-op behavior)', async () => {
        // Arrange: simulate the handleSave logic where empty strings are omitted.
        // An optional field (e.g. twitter) cleared to '' is never added to the body,
        // so the server-side value is NOT removed. This is the intentional v1 behavior.
        const updatedAccomm = makeAccommodationProtected();

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: updatedAccomm })
        );

        // Act: build body the same way handleSave does — only include truthy fields.
        const twitter = '';
        const phone = '+54 11 1234-5678';
        const partialBody: Record<string, string> = {};
        if (twitter) partialBody.twitter = twitter; // cleared — omitted
        if (phone) partialBody.phone = phone; // present — included

        await apiFetch({
            path: `/api/v1/protected/accommodations/${UUID_ACC}`,
            method: 'PATCH',
            body: partialBody,
            schema: AccommodationProtectedSchema
        });

        // Assert: the sent JSON body does NOT contain the cleared field.
        const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
        const sentBody = JSON.parse(requestInit?.body as string) as Record<string, unknown>;
        expect(sentBody).not.toHaveProperty('twitter');
        expect(sentBody.phone).toBe('+54 11 1234-5678');
    });

    it('sends the body as JSON in the request', async () => {
        const updatedAccomm = makeAccommodationProtected();

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: updatedAccomm })
        );

        await apiFetch({
            path: `/api/v1/protected/accommodations/${UUID_ACC}`,
            method: 'PATCH',
            body: { summary: 'Updated summary text here.' },
            schema: AccommodationProtectedSchema
        });

        const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
        const sentBody = JSON.parse(requestInit?.body as string) as unknown;
        expect((sentBody as { summary?: string }).summary).toBe('Updated summary text here.');
    });
});
