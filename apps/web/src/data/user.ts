import type { Actor } from '@repo/service-core';
import type { UserId } from '@repo/types';
import { RoleEnum, createPublicUser } from '@repo/types';

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
                    id: userId as UserId,
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
