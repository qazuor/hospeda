/**
 * @file auth-cache.ts
 * @description Shared constants for the client-side `/auth/me` cache that
 * UserMenu populates after the first hydration and the rest of the client
 * islands (NewsletterForm, AuthedPreferenceSync, refreshBetterAuthSession)
 * consume to short-circuit `/auth/me` fetches.
 *
 * Centralising the cache key in a single module prevents the silent drift
 * that happens when the literal is duplicated in multiple files: a rename
 * in one place leaves the others reading from a stale namespace and the
 * cache splits into writer/reader halves without any test catching it.
 */

/**
 * sessionStorage key under which the `/auth/me` snapshot is cached.
 *
 * Producers (UserMenu) write `{ isAuthenticated, user, permissions, cachedAt }`
 * as JSON. Consumers (NewsletterForm, AuthedPreferenceSync, auth-client)
 * read and TTL-check via the matching `AUTH_ME_CACHE_TTL_MS` from UserMenu.
 *
 * Invalidated by `refreshBetterAuthSession()` after operations that mutate
 * the underlying user record (e.g. profile completion).
 */
export const AUTH_ME_CACHE_KEY = 'authMeSnapshot' as const;
