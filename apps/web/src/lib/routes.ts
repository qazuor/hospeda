/**
 * Centralized route segment constants for middleware and navigation.
 * Protected and auth route paths are defined here to avoid duplication.
 *
 * These constants are used by middleware-helpers.ts and any other module
 * that needs to identify route types at runtime.
 */

/**
 * URL path segments that require an authenticated session.
 * Checked against the second segment of the path: /{locale}/{segment}/...
 */
export const PROTECTED_SEGMENTS = ['mi-cuenta'] as const;

/**
 * URL path segments that belong to the authentication flow.
 * Checked against the second segment of the path: /{locale}/{segment}/...
 */
export const AUTH_SEGMENTS = ['auth'] as const;

/**
 * URL path segments where the session is parsed (if available) but NOT required.
 * Unlike PROTECTED_SEGMENTS, unauthenticated users are NOT redirected to login.
 * Used to pre-fill user info in forms (e.g. feedback).
 */
export const SESSION_OPTIONAL_SEGMENTS = ['feedback', 'alojamientos'] as const;

/**
 * URL path prefixes that should bypass middleware entirely.
 * These are internal Astro/Vite asset routes and common static files.
 */
export const STATIC_PREFIXES = ['/_astro/', '/favicon', '/api/'] as const;

/** Type representing a protected route segment. */
export type ProtectedSegment = (typeof PROTECTED_SEGMENTS)[number];

/** Type representing an auth route segment. */
export type AuthSegment = (typeof AUTH_SEGMENTS)[number];
