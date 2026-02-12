import { AuthSignOutResponseSchema } from '@repo/schemas';
import { clearRateLimitStore } from '../../middlewares/rate-limit';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

/**
 * Sign out cleanup endpoint.
 * Invalidates user cache and clears rate limit store.
 * The actual session invalidation is handled by Better Auth at /api/auth/sign-out.
 * This endpoint handles Hospeda-specific server-side cleanup.
 */
export const authSignOutRoute = createSimpleRoute({
    method: 'post',
    path: '/signout',
    summary: 'Sign out and cleanup server state',
    description: 'Invalidates user cache and performs server-side cleanup for sign out',
    tags: ['Auth'],
    options: { skipAuth: true },
    responseSchema: AuthSignOutResponseSchema,
    handler: async (c) => {
        try {
            const user = c.get('user');
            const userId = user?.id;
            let cacheCleared = false;

            if (userId) {
                userCache.invalidate(userId);
                cacheCleared = true;
                apiLogger.debug(`Cache invalidated for user ${userId} during sign out`);
            } else {
                apiLogger.debug('Sign out called without user ID - no cache to clear');
            }

            clearRateLimitStore();
            apiLogger.debug('Rate limit store cleared during sign out');

            return {
                message: 'Sign out successful',
                cacheCleared
            };
        } catch (error) {
            apiLogger.error({ message: 'Sign out error', error });
            return {
                message: 'Sign out completed with warnings',
                cacheCleared: false
            };
        }
    }
});
