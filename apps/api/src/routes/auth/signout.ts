import { getAuth } from '@hono/clerk-auth';
import { AuthSignOutResponseSchema } from '@repo/schemas';
import { clearRateLimitStore } from '../../middlewares/rate-limit';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

/**
 * Sign out endpoint that cleans up server-side state
 * Invalidates user cache and performs cleanup
 */
export const authSignOutRoute = createSimpleRoute({
    method: 'post',
    path: '/signout',
    summary: 'Sign out and cleanup server state',
    description: 'Invalidates user cache and performs server-side cleanup for sign out',
    tags: ['Auth'],
    options: { skipAuth: true }, // Allow sign out without authentication
    responseSchema: AuthSignOutResponseSchema,
    handler: async (c) => {
        try {
            // Get the current user ID from Clerk if available
            const auth = getAuth(c);
            const userId = auth?.userId;
            let cacheCleared = false;

            if (userId) {
                // Invalidate the specific user from cache
                userCache.invalidate(userId);
                cacheCleared = true;
                apiLogger.debug(`🗑️ Cache invalidated for user ${userId} during sign out`);
            } else {
                // If no user ID, just log that sign out was called
                apiLogger.debug('🗑️ Sign out called without user ID - no cache to clear');
            }

            // Clear rate limit store to prevent rate limit issues after sign out
            clearRateLimitStore();
            apiLogger.debug('🗑️ Rate limit store cleared during sign out');

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
