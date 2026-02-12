import { defineMiddleware } from 'astro:middleware';

/**
 * Astro middleware for Better Auth session handling.
 *
 * Better Auth uses cookie-based sessions that are automatically
 * sent with requests. Auth-protected pages validate sessions by
 * calling the Better Auth API directly. This middleware is a
 * pass-through that can be extended for session pre-loading.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
    return next();
});
