/**
 * Regression tests for the protected self-profile PATCH route.
 *
 * Guards against system-flag mass-assignment on
 * `PATCH /api/v1/protected/users/:id`. The route body schema is an explicit
 * allowlist (`pick`) of user-editable fields. Two failure modes are covered:
 *
 *  1. Zod default injection — `UserSchema` declares system flags
 *     (`emailVerified`, `profileCompleted`, `banned`, ...) with `.default()`.
 *     A `.partial()` schema does NOT suppress those defaults: a partial PATCH
 *     that omits them still has Zod inject `false`/`[]`, which the service
 *     would then persist (resetting email verification / onboarding state).
 *  2. Explicit mass-assignment — a crafted body that sends the system flags
 *     directly must have them stripped before reaching the service.
 *
 * The test drives the full pipeline (HTTP → Hono zValidator → handler) with
 * the service mocked, and asserts on the exact input `UserService.update`
 * receives — schema unit tests alone would not prove the route wiring.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable ref for the mocked `UserService.update`. `vi.mock()` hoists its
 * factory above outer const declarations, so the factory reads through this
 * ref instead of closing over a `const` directly.
 */
const userServiceRef: { update: ReturnType<typeof vi.fn> } = {
    update: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        UserService: vi.fn().mockImplementation(() => ({
            update: (...args: unknown[]) => userServiceRef.update(...args)
        }))
    };
});

import { initApp } from '../../../../src/app';
import { validateApiEnv } from '../../../../src/utils/env';

// Must be a valid v4 UUID: `UserIdSchema` rejects nil/non-v4 forms.
const validUuid = 'b3f1d2c4-5e6a-4b7c-8d9e-0f1a2b3c4d5e';

const selfActor = {
    id: validUuid,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCESS_API_PRIVATE]
};

/** Minimal `UserSelfSchema`-valid response so the route serializes a 200. */
const mockUser = {
    id: validUuid,
    slug: 'carlos-tester',
    role: RoleEnum.USER,
    firstName: 'Carlos',
    email: 'carlos@local.test'
};

/** System flags that must never reach the service from the web PATCH. */
const SYSTEM_FLAGS = [
    'emailVerified',
    'profileCompleted',
    'setPasswordPrompted',
    'banned',
    'serviceSuspended',
    'permissions',
    'role'
] as const;

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

describe('PATCH /protected/users/:id — system-flag mass-assignment guard', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        userServiceRef.update = vi.fn().mockResolvedValue({ data: mockUser, error: null });
    });

    it('partial PATCH does not mass-assign system flags via Zod defaults', async () => {
        // Arrange + Act: a partial body that only edits the display name.
        const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(selfActor),
            body: JSON.stringify({ firstName: 'Carlos' })
        });

        // Assert
        expect(res.status).toBe(200);
        expect(userServiceRef.update).toHaveBeenCalledTimes(1);

        const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
        expect(input).toHaveProperty('firstName', 'Carlos');
        for (const flag of SYSTEM_FLAGS) {
            expect(
                Object.prototype.hasOwnProperty.call(input, flag),
                `system flag '${flag}' must not be injected into the service input`
            ).toBe(false);
        }
    });

    it('strips system flags sent explicitly in the body', async () => {
        // Arrange + Act: a crafted body trying to escalate / reset state.
        const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(selfActor),
            body: JSON.stringify({
                firstName: 'Carlos',
                emailVerified: false,
                profileCompleted: false,
                banned: true,
                serviceSuspended: true,
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
            })
        });

        // Assert
        expect(res.status).toBe(200);
        const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
        expect(input).toHaveProperty('firstName', 'Carlos');
        for (const flag of SYSTEM_FLAGS) {
            expect(
                Object.prototype.hasOwnProperty.call(input, flag),
                `explicit system flag '${flag}' must be stripped before the service`
            ).toBe(false);
        }
    });

    it('forwards legitimate editable fields to the service', async () => {
        // Arrange + Act
        const res = await app.request(`/api/v1/protected/users/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(selfActor),
            body: JSON.stringify({
                displayName: 'Carlos T',
                firstName: 'Carlos',
                lastName: 'Tester'
            })
        });

        // Assert
        expect(res.status).toBe(200);
        const input = (userServiceRef.update.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
        expect(input).toMatchObject({
            displayName: 'Carlos T',
            firstName: 'Carlos',
            lastName: 'Tester'
        });
    });
});
