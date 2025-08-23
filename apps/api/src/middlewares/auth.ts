/**
 * Authentication middleware using Clerk
 * Provides Clerk-based authentication for protected routes
 */

import { clerkMiddleware } from '@hono/clerk-auth';
import { env } from '../utils/env';

/**
 * Creates Clerk authentication middleware
 * Uses environment variables for configuration
 * @returns Clerk middleware instance
 * @throws Error if required Clerk environment variables are not set
 */
export const clerkAuth = () => {
    if (!env.CLERK_SECRET_KEY || !env.PUBLIC_CLERK_PUBLISHABLE_KEY) {
        throw new Error(
            'Clerk environment variables (CLERK_SECRET_KEY, PUBLIC_CLERK_PUBLISHABLE_KEY) are required for authentication middleware'
        );
    }

    return clerkMiddleware({
        secretKey: env.CLERK_SECRET_KEY,
        publishableKey: env.PUBLIC_CLERK_PUBLISHABLE_KEY
    });
};
