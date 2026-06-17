/**
 * @file use-patch-user.test.ts
 * @description Unit tests for usePatchUser: Zod body parsing + body shape for
 * name / phone / location / settings.notifications (SPEC-243 T-055).
 *
 * Tests run in the `node` Vitest environment (no React Native runtime).
 * `fetch` and `getCookie` are mocked so the test never hits the network.
 *
 * Coverage:
 * - UserPatchBodySchema: valid full body → parses correctly
 * - UserPatchBodySchema: partial body (firstName only) → parses correctly
 * - UserPatchBodySchema: body with contactInfo.mobilePhone → phone mapped correctly
 * - UserPatchBodySchema: body with location (city/region/country) → nested object correct
 * - UserPatchBodySchema: body with settings.notifications (all 4 booleans) → parses correctly
 * - UserPatchBodySchema: firstName too short (< 2 chars) → fails parse with path firstName
 * - UserPatchBodySchema: empty body → parses as empty object (all optional)
 * - apiFetch success path: PATCH with name+phone body → request made with correct shape
 * - apiFetch error: 403 Forbidden → ApiError
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';

// ---------------------------------------------------------------------------
// Mocks — before module imports
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
import { UserPatchBodySchema } from './use-patch-user';

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

const UUID_USER = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
    contactInfo: { mobilePhone: '+54 11 00000000' },
    location: null,
    socialNetworks: null,
    settings: null,
    profile: null
});

// ---------------------------------------------------------------------------
// UserPatchBodySchema unit tests
// ---------------------------------------------------------------------------

describe('UserPatchBodySchema', () => {
    it('parses a full body with all editable fields', () => {
        const body = {
            firstName: 'Juan',
            lastName: 'García',
            contactInfo: { mobilePhone: '+54 11 12345678' },
            location: {
                city: 'Concepción del Uruguay',
                region: 'Entre Ríos',
                country: 'Argentina'
            },
            settings: {
                notifications: {
                    enabled: true,
                    allowPush: false,
                    allowEmails: true,
                    allowSms: false
                }
            }
        };
        const result = UserPatchBodySchema.safeParse(body);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.firstName).toBe('Juan');
            expect(result.data.lastName).toBe('García');
            expect(result.data.contactInfo?.mobilePhone).toBe('+54 11 12345678');
            expect(result.data.location?.city).toBe('Concepción del Uruguay');
            expect(result.data.settings?.notifications?.enabled).toBe(true);
            expect(result.data.settings?.notifications?.allowPush).toBe(false);
        }
    });

    it('parses a partial body with firstName only', () => {
        const result = UserPatchBodySchema.safeParse({ firstName: 'María' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.firstName).toBe('María');
            expect(result.data.lastName).toBeUndefined();
            expect(result.data.contactInfo).toBeUndefined();
        }
    });

    it('parses an empty body (all fields optional)', () => {
        const result = UserPatchBodySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toStrictEqual({});
        }
    });

    it('maps contactInfo.mobilePhone correctly', () => {
        const body = { contactInfo: { mobilePhone: '+54 9 11 55556666' } };
        const result = UserPatchBodySchema.safeParse(body);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.contactInfo?.mobilePhone).toBe('+54 9 11 55556666');
        }
    });

    it('maps location with city / region / country', () => {
        const body = {
            location: { city: 'Buenos Aires', region: 'CABA', country: 'Argentina' }
        };
        const result = UserPatchBodySchema.safeParse(body);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.city).toBe('Buenos Aires');
            expect(result.data.location?.country).toBe('Argentina');
        }
    });

    it('parses settings.notifications with all 4 boolean toggles', () => {
        const body = {
            settings: {
                notifications: {
                    enabled: false,
                    allowPush: false,
                    allowEmails: true,
                    allowSms: true
                }
            }
        };
        const result = UserPatchBodySchema.safeParse(body);
        expect(result.success).toBe(true);
        if (result.success) {
            const notif = result.data.settings?.notifications;
            expect(notif?.enabled).toBe(false);
            expect(notif?.allowPush).toBe(false);
            expect(notif?.allowEmails).toBe(true);
            expect(notif?.allowSms).toBe(true);
        }
    });

    it('fails when firstName is shorter than 2 characters', () => {
        const result = UserPatchBodySchema.safeParse({ firstName: 'A' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('firstName');
        }
    });

    it('fails when lastName is longer than 50 characters', () => {
        const result = UserPatchBodySchema.safeParse({ lastName: 'A'.repeat(51) });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('lastName');
        }
    });

    it('fails when mobilePhone contains a hyphen (invalid E.164 format)', () => {
        // Hyphenated phones like '+54 11 1234-5678' must be rejected client-side
        // so the server never receives them and returns a generic 400.
        const result = UserPatchBodySchema.safeParse({
            contactInfo: { mobilePhone: '+54 11 1234-5678' }
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('contactInfo.mobilePhone');
        }
    });
});

// ---------------------------------------------------------------------------
// apiFetch PATCH paths
// ---------------------------------------------------------------------------

describe('apiFetch with user PATCH path', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('returns updated UserSelf on a valid PATCH 200 response', async () => {
        const patchedUser = { ...makeUserSelfStub(), firstName: 'Updated' };

        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: patchedUser })
        );

        const { data } = await apiFetch({
            path: `/api/v1/protected/users/${UUID_USER}`,
            method: 'PATCH',
            body: { firstName: 'Updated' },
            schema: UserSelfSchema
        });

        expect(data.firstName).toBe('Updated');
        expect(data.id).toBe(UUID_USER);
    });

    it('throws ApiError on 403 Forbidden', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse(
                { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
                403
            )
        );

        await expect(
            apiFetch({
                path: `/api/v1/protected/users/${UUID_USER}`,
                method: 'PATCH',
                body: { firstName: 'X' },
                schema: UserSelfSchema
            })
        ).rejects.toBeInstanceOf(ApiError);
    });

    it('sends the correct body shape for name + phone + location', async () => {
        const patchedUser = makeUserSelfStub();
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: patchedUser })
        );

        const body = {
            firstName: 'Juan',
            contactInfo: { mobilePhone: '+54 11 99998888' },
            location: { city: 'Paraná', region: 'Entre Ríos', country: 'Argentina' }
        };

        await apiFetch({
            path: `/api/v1/protected/users/${UUID_USER}`,
            method: 'PATCH',
            body,
            schema: UserSelfSchema
        });

        const callArgs = vi.mocked(fetch).mock.calls[0];
        expect(callArgs).toBeDefined();
        const [_url, init] = callArgs as [string, RequestInit];
        const sentBody = JSON.parse(init.body as string) as typeof body;
        expect(sentBody.firstName).toBe('Juan');
        expect(sentBody.contactInfo?.mobilePhone).toBe('+54 11 99998888');
        expect(sentBody.location?.city).toBe('Paraná');
    });
});
