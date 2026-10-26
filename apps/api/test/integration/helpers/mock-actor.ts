import { randomUUID } from 'node:crypto';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { createTestUser } from '../../e2e/setup/seed-helpers';

/** Permissions every admin-tier request needs to pass the admin gate. */
export const ADMIN_GATE_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
];

/** Input for {@link buildMockActorHeaders}. */
export interface BuildMockActorHeadersInput {
    /** Id of a REAL user row (the actor middleware resolves it). */
    readonly actorId: string;
    /** Permissions the mock actor holds. */
    readonly permissions: readonly PermissionEnum[];
    /** Role the mock actor carries. Defaults to USER; admin-tier tests pass ADMIN. */
    readonly role?: RoleEnum;
    /** Extra headers merged last. */
    readonly extra?: Readonly<Record<string, string>>;
}

/**
 * Builds the request headers of the test-only mock actor. Always sends a
 * `user-agent`, because the app answers 400 to any request without one and a
 * "400" or "401" assertion would otherwise pass for the wrong reason.
 *
 * Needs `HOSPEDA_ALLOW_MOCK_ACTOR=true` and `CI` unset in the test process.
 *
 * @param input - Actor id, permissions and optional extra headers.
 * @returns Headers for `app.request`.
 */
export function buildMockActorHeaders({
    actorId,
    permissions,
    role = RoleEnum.USER,
    extra = {}
}: BuildMockActorHeadersInput): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions),
        ...extra
    };
}

/**
 * Creates a real user row to back a mock actor.
 *
 * @param input.label - Short label embedded in the generated email and slug.
 * @returns The new user's id.
 */
export async function createMockActorUser({
    label
}: {
    readonly label: string;
}): Promise<{ readonly id: string }> {
    const suffix = randomUUID();
    const user = await createTestUser({
        email: `${label}-${suffix}@example.test`,
        slug: `${label}-${suffix}`
    });
    return { id: user.id };
}
