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
 * Used to pre-fill user info in forms (e.g. feedback), to let pages run their
 * own in-page auth guard (e.g. /publicar/nueva), or to forward the auth state
 * to interactive islands like FavoriteButton on entity listings/details.
 */
export const SESSION_OPTIONAL_SEGMENTS = [
    'feedback',
    'alojamientos',
    'destinos',
    'eventos',
    'publicaciones',
    'guest',
    'publicar',
    // Gastronomy public listing + detail (SPEC-239)
    'gastronomia',
    // Experiences & services public listing + detail (SPEC-240)
    'experiencias'
] as const;

/**
 * URL path prefixes that should bypass middleware entirely.
 * These are internal Astro/Vite asset routes and common static files.
 */
export const STATIC_PREFIXES = ['/_astro/', '/favicon', '/api/'] as const;

/**
 * Top-level URL prefix for the private beta tester documentation site.
 * Pages under this prefix:
 * - skip locale enforcement (the docs are Spanish-only, no `/{lang}/` namespace);
 * - skip session parsing and auth protection (access is via secret URL only);
 * - receive a `X-Robots-Tag: noindex, nofollow` response header;
 * - render an isolated `BetaDocLayout` (does NOT extend `BaseLayout`).
 *
 * Lifetime: this entire surface is removed when the beta period ends.
 */
export const BETA_PREFIX = '/beta' as const;

/** Type representing a protected route segment. */
export type ProtectedSegment = (typeof PROTECTED_SEGMENTS)[number];

/** Type representing an auth route segment. */
export type AuthSegment = (typeof AUTH_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// SPEC-113: Profile completion flow routes
// ---------------------------------------------------------------------------

/**
 * Sub-path of the profile completion form (under /{locale}/mi-cuenta/).
 * Whitelisted in the middleware guard so the user can actually submit the form.
 */
export const PROFILE_COMPLETION_SEGMENT = 'completar-perfil' as const;

/**
 * Sub-path of the set-password form (under /{locale}/mi-cuenta/).
 * Whitelisted in the middleware guard so the user can submit or skip.
 */
export const SET_PASSWORD_SEGMENT = 'agregar-contrasena' as const;

/**
 * Sub-path of the change-password form (under /{locale}/mi-cuenta/).
 * Used by commerce owners who must rotate their password on first login (SPEC-239 T-041).
 * Whitelisted in the middleware guard analogously to SET_PASSWORD_SEGMENT.
 */
export const CHANGE_PASSWORD_SEGMENT = 'cambiar-contrasena' as const;

/**
 * Role values that skip the profile completion + set-password checks.
 * Admins and super-admins bypass the flow per spec §3.5.
 */
export const PROFILE_COMPLETION_BYPASS_ROLES = ['admin', 'super_admin'] as const;

/** Type for roles that bypass profile completion. */
export type ProfileCompletionBypassRole = (typeof PROFILE_COMPLETION_BYPASS_ROLES)[number];

/**
 * Path segments that live under `SESSION_OPTIONAL_SEGMENTS` (auth NOT required
 * at middleware level) but DO need to enforce the profile-completion guard
 * when the visitor IS signed in.
 *
 * Spec §3.4 mandates that "any other protected route" funnels the user back
 * to the completion form. Segments like `publicar` aren't in
 * `PROTECTED_SEGMENTS` because anonymous visitors are allowed to land on
 * them (the page itself shows a sign-in prompt), but a signed-in user with
 * `profile_completed = FALSE` must still be bounced back to
 * `completar-perfil`. Without this list, a user who closed the tab mid-form
 * could sneak into the host onboarding flow.
 */
export const PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS = ['publicar'] as const;
