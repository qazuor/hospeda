/**
 * Cache and compression endpoint classification constants.
 *
 * These path prefixes are part of the API surface contract — they are code,
 * not configuration. Operators do not (and should not) tune them via env vars.
 * Changing the cacheability of an endpoint is an architectural decision that
 * goes through code review, not deploy-time configuration.
 */

/**
 * Path prefixes that receive public cache headers (cacheable by CDN).
 * Used for read-only endpoints with no per-user data.
 */
export const PUBLIC_CACHE_ENDPOINTS = [
    '/api/v1/public/accommodations',
    '/api/v1/public/destinations',
    '/api/v1/public/events',
    '/api/v1/public/posts',
    '/api/v1/public/amenities',
    '/api/v1/public/features',
    '/api/v1/public/attractions',
    '/api/v1/public/event-locations',
    '/api/v1/public/event-organizers',
    '/api/v1/public/exchange-rates',
    '/api/v1/public/posts/tags',
    '/api/v1/public/search',
    '/api/v1/public/stats',
    '/api/v1/public/testimonials',
    '/health'
] as const;

/**
 * Path prefixes that receive private cache headers (cacheable only by browser).
 * Used for per-user data.
 */
export const PRIVATE_CACHE_ENDPOINTS = [
    '/api/v1/public/users',
    '/api/v1/public/conversations',
    '/api/v1/public/plans',
    '/api/v1/public/user-bookmarks'
] as const;

/**
 * Path prefixes that must always hit the origin (no-store).
 * Diagnostics, docs, webhooks, admin metrics, and Better Auth (cookie-bound).
 */
export const NO_CACHE_ENDPOINTS = [
    '/health/db',
    '/docs',
    '/api/v1/webhooks',
    '/api/v1/admin/metrics',
    '/api/auth'
] as const;

/**
 * Path prefixes that bypass response compression.
 * Useful for health checks where overhead matters more than bytes saved.
 */
export const COMPRESSION_EXCLUDE_ENDPOINTS = ['/health/db', '/docs'] as const;
