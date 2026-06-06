/**
 * Regression test: complete-profile data loss on the self-profile routes.
 *
 * The onboarding flow persists phone into `contactInfo.mobilePhone`, location
 * into the `location` JSONB and socials into `socialNetworks`. The protected
 * GET/PUT/PATCH `/users/{id}` routes declared `UserProtectedSchema` as their
 * response contract, which does NOT include those JSONB fields — so
 * `stripWithSchema` (SPEC-087) silently dropped them and the web edit-profile
 * form always rehydrated empty (phone, country, province, city all blank).
 *
 * These tests capture each route's declared `responseSchema` and run a
 * realistic DB user row through it, asserting the JSONB blobs survive the
 * strip. With `UserProtectedSchema` they fail; with `UserSelfSchema` they pass.
 *
 * Pattern: same handler/config-capture mock used in `update.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ZodTypeAny } from 'zod';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedConfigs } = vi.hoisted(() => ({
    capturedConfigs: [] as Array<{
        method: string;
        path: string;
        responseSchema?: unknown;
    }>
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn(
        (config: { method: string; path: string; responseSchema?: unknown }) => {
            capturedConfigs.push(config);
            return config;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('../../../../src/utils/openapi-schema', () => ({
    transformApiInputToDomain: <T>(input: T): T => input
}));

vi.mock('../../../../src/utils/user-cache', () => ({
    userCache: { invalidate: vi.fn() }
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

vi.mock('@repo/service-core', () => ({
    UserService: vi.fn(() => ({})),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

// ---------------------------------------------------------------------------
// Imports after mocks — trigger module execution so configs are captured.
// ---------------------------------------------------------------------------

import { RoleEnum, type UserSelf } from '@repo/schemas';

await import('../../../../src/routes/user/protected/getById');
await import('../../../../src/routes/user/protected/update');
await import('../../../../src/routes/user/protected/patch');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A realistic `users` row as the service returns it: phone/location/socials
 * live in JSONB columns, never as flat top-level fields.
 */
const DB_USER_ROW = {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    slug: 'maria-perez',
    displayName: 'María Pérez',
    firstName: 'María',
    lastName: 'Pérez',
    role: RoleEnum.USER,
    email: 'maria@example.com',
    contactInfo: {
        mobilePhone: '+5493442123456',
        personalEmail: 'maria@example.com'
    },
    location: {
        country: 'AR',
        region: 'Entre Ríos',
        city: 'Concepción del Uruguay'
    },
    socialNetworks: {
        facebook: 'https://facebook.com/mariaperez'
    },
    profile: null,
    settings: null,
    permissions: []
};

const routeConfig = (method: string) => {
    const config = capturedConfigs.find((c) => c.method === method && c.path === '/{id}');
    if (!config?.responseSchema) {
        throw new Error(`No responseSchema captured for ${method} /{id}`);
    }
    return config as { responseSchema: ZodTypeAny };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each(['get', 'put', 'patch'])(
    'Self-profile %s /{id} response contract',
    (method: string) => {
        it('preserves contactInfo, location and socialNetworks through the response strip', () => {
            const { responseSchema } = routeConfig(method);

            const result = responseSchema.safeParse(DB_USER_ROW);

            expect(result.success).toBe(true);
            const data = result.data as UserSelf;
            expect(data.contactInfo?.mobilePhone).toBe('+5493442123456');
            expect(data.location).toEqual({
                country: 'AR',
                region: 'Entre Ríos',
                city: 'Concepción del Uruguay'
            });
            expect(data.socialNetworks?.facebook).toBe('https://facebook.com/mariaperez');
        });

        it('does not 500 on a row whose contactInfo lacks mobilePhone (read-side tolerance)', () => {
            const { responseSchema } = routeConfig(method);

            const result = responseSchema.safeParse({
                ...DB_USER_ROW,
                contactInfo: { personalEmail: 'maria@example.com' }
            });

            expect(result.success).toBe(true);
        });
    }
);
