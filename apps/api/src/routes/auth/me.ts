import { UserModel } from '@repo/db';
import { AuthMeResponseSchema, PermissionEnum } from '@repo/schemas';
import { createGuestActor, isGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

export const authMeRoute = createSimpleRoute({
    method: 'get',
    path: '/me',
    summary: 'Current authenticated actor',
    description: 'Returns current actor resolved by middleware and auth status.',
    tags: ['Auth'],
    options: { skipAuth: true }, // Skip auth middleware to check auth status
    responseSchema: AuthMeResponseSchema,
    handler: async (c) => {
        try {
            // Get actor from context (set by actor middleware)
            const actor = c.get('actor');

            // Check if user is authenticated by checking if actor is not a guest
            const isAuthenticated = !isGuestActor(actor);

            // Return all permissions for authenticated users.
            // Permissions are public knowledge to the user themselves and needed
            // for client-side feature gating (e.g. admin panel access checks).
            const filteredActor = actor;

            // Check passwordChangeRequired flag for admin panel users
            let passwordChangeRequired = false;
            const hasAdminAccess = actor.permissions.includes(PermissionEnum.ACCESS_PANEL_ADMIN);
            if (isAuthenticated && hasAdminAccess) {
                try {
                    const userModel = new UserModel();
                    const dbUser = await userModel.findById(actor.id);
                    if (dbUser?.adminInfo?.passwordChangeRequired) {
                        passwordChangeRequired = true;
                    }
                } catch {
                    // Non-blocking: default false
                }
            }

            const result = { actor: filteredActor, isAuthenticated, passwordChangeRequired };
            apiLogger.debug({ message: 'AuthMe: Returning result', result });
            return result;
        } catch (error) {
            apiLogger.error({ message: 'Error in /auth/me', error });
            // Return guest actor if there's an error
            return {
                actor: createGuestActor(),
                isAuthenticated: false
            };
        }
    }
});
