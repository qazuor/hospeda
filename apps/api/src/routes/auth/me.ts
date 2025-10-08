import { AuthMeResponseSchema } from '@repo/schemas';
import { createGuestActor } from '../../utils/actor';
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
            const isAuthenticated = actor.role !== 'GUEST';

            const result = { actor, isAuthenticated };
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
