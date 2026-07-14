/**
 * Regression tests for BETA-34 across the remaining three user write
 * routes (protected PUT, admin PATCH, admin PUT). The protected PATCH route
 * is covered separately in
 * `test/routes/user/protected/patch-mass-assignment.test.ts`.
 *
 * Root cause: the domain `UserSchema.birthDate` is `z.date().nullish()`.
 * Used directly on an HTTP request body schema, the route-factory's
 * automatic `z.date()` → `z.string().datetime()` OpenAPI conversion
 * (`convertDateField` in `src/utils/openapi-schema.ts`) turned it into a
 * full ISO-8601 datetime validator — rejecting the plain `YYYY-MM-DD`
 * string every `<input type="date">` submits with 400 `Invalid ISO
 * datetime`. Each route now overrides `birthDate` with
 * `BirthDateHttpInputSchema` and converts the parsed string to a domain
 * `Date | null` via `withDomainBirthDate()` before calling the service.
 *
 * Drives the full pipeline (HTTP → Hono zValidator → handler) with
 * `UserService` mocked, so it exercises the real body schema (including the
 * OpenAPI conversion route-factory applies) — not just the handler logic.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const userServiceRef: { update: Mock; getById: Mock } = {
    update: vi.fn(),
    getById: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        UserService: vi.fn().mockImplementation(function () {
            return {
                update: (...args: unknown[]) => userServiceRef.update(...args),
                getById: (...args: unknown[]) => userServiceRef.getById(...args)
            };
        })
    };
});

import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

// Must be a valid v4 UUID: `UserIdSchema` rejects nil/non-v4 forms.
const validUuid = 'b3f1d2c4-5e6a-4b7c-8d9e-0f1a2b3c4d5e';
const targetUuid = 'c4f1d2c4-5e6a-4b7c-8d9e-0f1a2b3c4d5f';

const selfActor = {
    id: validUuid,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCESS_API_PRIVATE]
};

/**
 * All four admin write/read routes registered at the same Hono path
 * (`/{id}`: GET, PUT, PATCH, DELETE) share ONE sub-router, and Hono's
 * `.use(path, middleware)` is method-agnostic — every route's
 * `adminAuthMiddleware(requiredPermissions)` runs for every request that
 * matches the path, not just requests using that route's own HTTP method
 * (pre-existing behavior, unrelated to BETA-34). A minimal actor holding
 * only `MANAGE_USERS` (the PATCH/PUT route's own declared requirement) gets
 * rejected by `getById`'s `USER_READ_ALL` check, which runs first in
 * registration order. Grant the full read/write/delete permission set here
 * so this actor exercises the fix without tripping over that unrelated
 * cross-method leak — a real production admin has all of these anyway.
 */
const adminActor = {
    id: 'a1f1d2c4-5e6a-4b7c-8d9e-0f1a2b3c4d5e',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.MANAGE_USERS,
        PermissionEnum.USER_READ_ALL,
        PermissionEnum.USER_DELETE,
        PermissionEnum.USER_HARD_DELETE,
        PermissionEnum.USER_RESTORE
    ]
};

/** Minimal `UserSelfSchema`-valid response for the protected PUT route. */
const mockUser = {
    id: validUuid,
    slug: 'carlos-tester',
    role: RoleEnum.USER,
    firstName: 'Carlos',
    email: 'carlos@local.test'
};

/**
 * Minimal `UserAdminSchema`-valid response for the admin PATCH/PUT routes.
 * `UserAdminSchema` (unlike `UserSelfSchema`) requires audit/lifecycle
 * fields (`lifecycleState`, `visibility`, `createdAt`, `updatedAt`,
 * `deletedAt`, `createdById`, `updatedById`) with no default — omitting them
 * fails response-schema validation with a 500, not a 400.
 */
const mockAdminUser = {
    ...mockUser,
    id: targetUuid,
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null
};

function makeHeaders(actor: {
    id: string;
    role: string;
    permissions: string[];
}): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

describe('User write routes — birthDate HTTP input (BETA-34)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        // `mockAdminUser` is a superset of `mockUser`'s fields (extra keys are
        // silently stripped by schemas that don't require them), so the same
        // mock resolved value satisfies both `UserSelfSchema` (protected PUT)
        // and `UserAdminSchema` (admin PATCH/PUT).
        userServiceRef.update = vi.fn().mockResolvedValue({ data: mockAdminUser, error: null });
        userServiceRef.getById = vi
            .fn()
            .mockResolvedValue({ data: { id: targetUuid, role: RoleEnum.USER } });
    });

    describe('PUT /protected/users/:id', () => {
        it('accepts a YYYY-MM-DD birth date and forwards it as a Date', async () => {
            const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
                method: 'PUT',
                headers: makeHeaders(selfActor),
                body: JSON.stringify({ birthDate: '1990-05-15' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeInstanceOf(Date);
            expect((input.birthDate as Date).toISOString().startsWith('1990-05-15')).toBe(true);
        });

        it('accepts an empty string birthDate and forwards null', async () => {
            const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
                method: 'PUT',
                headers: makeHeaders(selfActor),
                body: JSON.stringify({ birthDate: '' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeNull();
        });

        it('rejects a full ISO-8601 datetime birth date with 400', async () => {
            const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
                method: 'PUT',
                headers: makeHeaders(selfActor),
                body: JSON.stringify({ birthDate: '1990-05-15T00:00:00Z' })
            });

            expect(res.status).toBe(400);
            expect(userServiceRef.update).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /admin/users/:id', () => {
        it('accepts a YYYY-MM-DD birth date and forwards it as a Date', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '1990-05-15' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeInstanceOf(Date);
            expect((input.birthDate as Date).toISOString().startsWith('1990-05-15')).toBe(true);
        });

        it('accepts an empty string birthDate and forwards null', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeNull();
        });

        it('rejects a full ISO-8601 datetime birth date with 400', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '1990-05-15T00:00:00Z' })
            });

            expect(res.status).toBe(400);
            expect(userServiceRef.update).not.toHaveBeenCalled();
        });
    });

    describe('PUT /admin/users/:id', () => {
        it('accepts a YYYY-MM-DD birth date and forwards it as a Date', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '1990-05-15' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeInstanceOf(Date);
            expect((input.birthDate as Date).toISOString().startsWith('1990-05-15')).toBe(true);
        });

        it('accepts an empty string birthDate and forwards null', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '' })
            });

            expect(res.status).toBe(200);
            const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<
                string,
                unknown
            >;
            expect(input.birthDate).toBeNull();
        });

        it('rejects a full ISO-8601 datetime birth date with 400', async () => {
            const res = await app.request(`/api/v1/admin/users/${targetUuid}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ birthDate: '1990-05-15T00:00:00Z' })
            });

            expect(res.status).toBe(400);
            expect(userServiceRef.update).not.toHaveBeenCalled();
        });
    });
});
