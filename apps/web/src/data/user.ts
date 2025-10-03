import type { UserIdType } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

// TODO [5273dbee-26fc-465c-817e-e174678685e0]: Temporary implementation until we move createPublicUser to @repo/schemas
const createPublicUser = () => ({
    id: '',
    email: 'guest@example.com',
    firstName: 'Guest',
    lastName: 'User',
    fullName: 'Guest User',
    role: RoleEnum.GUEST,
    permissions: []
});

type LocalsAuth = () => { userId?: string | null } | undefined | null;

export type GetCurrentUserInput = {
    /**
     * Optional Astro.locals reference when available in server context.
     * If provided, it should include the `auth()` function from Clerk middleware.
     */
    locals?: { auth?: LocalsAuth };
};

export type GetCurrentUserOutput = { actor: Actor };

/**
 * Returns the current web user in a unified shape.
 * - If Clerk auth is present and the request is authenticated, returns a minimal
 *   user containing the Clerk `userId`, USER role, and empty permissions.
 * - Otherwise, returns a public/guest user defined by `@repo/types#createPublicUser`.
 *
 * Notes
 * - This function is safe to call from prerendered pages; when no Clerk auth
 *   context exists it will return the public user.
 * - Extend mapping here if you later enrich the user from your API/DB.
 */
export const getCurrentUser = async ({
    locals
}: GetCurrentUserInput = {}): Promise<GetCurrentUserOutput> => {
    const authFn = locals?.auth;

    if (typeof authFn === 'function') {
        try {
            const authData = authFn();
            const userId = authData?.userId;
            if (userId) {
                const actor: Actor = {
                    id: userId as UserIdType,
                    role: RoleEnum.USER,
                    permissions: []
                };
                return { actor };
            }
        } catch {
            // Fall through to public user
        }
    }

    const publicUser = createPublicUser();
    const actor: Actor = {
        id: publicUser.id,
        role: publicUser.role,
        permissions: [...publicUser.permissions]
    };
    return { actor };
};
