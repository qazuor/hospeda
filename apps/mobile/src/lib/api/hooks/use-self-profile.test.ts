/**
 * @file use-self-profile.test.ts
 * @description Unit tests for useSelfProfile: schema parse + apiFetch error paths (SPEC-243 T-055).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so the test never hits the network.
 *
 * Coverage:
 * - Valid UserSelf payload (name + email + settings) → passes schema parse
 * - Nullable response (user not found / null) → passes schema parse as null
 * - Missing required `id` field → fails schema parse
 * - apiFetch error path: 401 → ApiError
 * - apiFetch error path: schema drift → ApiSchemaError
 * - apiFetch success: returns typed UserSelf data with contactInfo.mobilePhone
 * - apiFetch success: settings.notifications shape validated
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

import { UserSelfSchema } from '@repo/schemas';
import { apiFetch } from '../client';

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

/** Valid UUID v4 fixtures. UserSelfSchema.id uses z.string().uuid(). */
const UUID_USER = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Minimal valid UserSelf stub — only required fields per UserPublicSchema
 * (the base) and extended required fields.
 */
const makeUserSelfStub = () => ({
    id: UUID_USER,
    slug: 'test-user',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    role: 'USER',
    image: null,
    avatarUrl: null,
    permissions: [],
    contactInfo: {
        mobilePhone: '+54 11 12345678'
    },
    location: {
        city: 'Concepción del Uruguay',
        region: 'Entre Ríos',
        country: 'Argentina'
    },
    socialNetworks: null,
    settings: {
        notifications: {
            enabled: true,
            allowPush: true,
            allowEmails: true,
            allowSms: false
        }
    },
    profile: null
});

// ---------------------------------------------------------------------------
// Schema unit tests
// ---------------------------------------------------------------------------

describe('UserSelfSchema', () => {
    it('parses a valid UserSelf payload', () => {
        const stub = makeUserSelfStub();
        const result = UserSelfSchema.safeParse(stub);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe(UUID_USER);
            expect(result.data.contactInfo?.mobilePhone).toBe('+54 11 12345678');
            expect(result.data.location?.city).toBe('Concepción del Uruguay');
            expect(result.data.location?.region).toBe('Entre Ríos');
        }
    });

    it('parses null (nullable variant used by route)', () => {
        const result = UserSelfSchema.nullable().safeParse(null);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeNull();
        }
    });

    it('parses when contactInfo and location are null', () => {
        const stub = { ...makeUserSelfStub(), contactInfo: null, location: null };
        const result = UserSelfSchema.safeParse(stub);
        expect(result.success).toBe(true);
    });

    it('fails when id is missing', () => {
        const { id: _id, ...withoutId } = makeUserSelfStub();
        const result = UserSelfSchema.safeParse(withoutId);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('id');
        }
    });

    it('fails when id is not a valid UUID', () => {
        const stub = { ...makeUserSelfStub(), id: 'not-a-uuid' };
        const result = UserSelfSchema.safeParse(stub);
        expect(result.success).toBe(false);
    });

    it('parses settings.notifications with all boolean fields', () => {
        const stub = makeUserSelfStub();
        const result = UserSelfSchema.safeParse(stub);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.settings?.notifications?.enabled).toBe(true);
            expect(result.data.settings?.notifications?.allowPush).toBe(true);
            expect(result.data.settings?.notifications?.allowEmails).toBe(true);
            expect(result.data.settings?.notifications?.allowSms).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// apiFetch error paths
// ---------------------------------------------------------------------------

describe('apiFetch with self-profile path — error handling', () => {
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
                path: `/api/v1/protected/users/${UUID_USER}`,
                schema: UserSelfSchema.nullable()
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
                path: `/api/v1/protected/users/${UUID_USER}`,
                schema: UserSelfSchema.nullable()
            })
        ).rejects.toBeInstanceOf(ApiSchemaError);
    });

    it('returns typed UserSelf data on a valid 200 response', async () => {
        const validData = makeUserSelfStub();

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: validData })
        );

        const { data } = await apiFetch({
            path: `/api/v1/protected/users/${UUID_USER}`,
            schema: UserSelfSchema.nullable()
        });

        expect(data?.id).toBe(UUID_USER);
        expect(data?.contactInfo?.mobilePhone).toBe('+54 11 12345678');
    });

    it('returns null on a valid 200 response with null data', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse({ success: true, data: null }));

        const { data } = await apiFetch({
            path: `/api/v1/protected/users/${UUID_USER}`,
            schema: UserSelfSchema.nullable()
        });

        expect(data).toBeNull();
    });
});
