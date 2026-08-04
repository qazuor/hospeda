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
 * Used to pre-fill user info in forms (e.g. feedback) or to let pages run their
 * own in-page auth guard (e.g. /publicar/nueva).
 *
 * ## This list is a cache-safety boundary (HOS-369 W1-2a)
 *
 * Parsing the session here is what puts a value in `Astro.locals.user`, and the
 * SHELL reads it on every page it wraps: `Header.astro` hands `UserMenu` the
 * visitor's id, name, e-mail and avatar; `Footer.astro` hands `NewsletterForm`
 * their e-mail; `BaseLayout.astro` writes `<html data-user-authenticated>` and
 * forwards id/e-mail/name to the feedback host. Astro serializes island props
 * into the document, so all of that is TEXT IN THE HTML.
 *
 * A segment on this list therefore cannot be edge-cached, whatever its pages do:
 * even a perfectly session-blind page ships a personalized shell, and the cache
 * would hand one visitor's e-mail to the next for the whole TTL.
 *
 * The six public catalog families (`alojamientos`, `destinos`, `eventos`,
 * `publicaciones`, `gastronomia`, `experiencias`) were on this list because
 * their pages needed the visitor — for `FavoriteButton` state, review gates, and
 * the accommodation detail's conversation/price-alert/WhatsApp lookups. HOS-369
 * Wave B0 moved every one of those into the browser, so nothing under them
 * consumes the session any more and they were REMOVED. Two things follow, and
 * both are intended:
 *
 * - The shell renders its guest variant there. A signed-in visitor sees it for
 *   one frame until `UserMenu` resolves `/auth/me` — the behaviour that already
 *   applies on SSG/public routes and that `BaseLayout`/`MobileMenuIsland` both
 *   document. A cached page cannot know who you are; this is the cost of the
 *   cache, not a defect.
 * - Those routes stop issuing a `get-session` call per page view, which is a
 *   direct win on the highest-traffic paths in the app.
 *
 * `test/lib/cacheable-routes-parse-no-session.guard.test.ts` asserts the
 * invariant: no cacheable route family may appear here.
 */
export const SESSION_OPTIONAL_SEGMENTS = [
    'feedback',
    'guest',
    'publicar',
    // Commerce lead forms — "Sumá tu negocio" (HOS-295).
    //
    // Both pages mount the CommerceLead island, which pre-fills the visitor's
    // name and email when they are signed in. An island cannot read
    // `Astro.locals`, so the page frontmatter has to hand the user down as a
    // prop — and the frontmatter only has one if the middleware resolved the
    // session here. The match is on the exact segment, so the pre-existing
    // `publicar` entry does NOT cover `publicar-restaurante`; both need listing.
    //
    // These stay OUT of `PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS`
    // on purpose — see the note on that constant.
    //
    // Consequence to keep in mind: both pages now render user-dependent HTML
    // (the visitor's name and email are baked into the SSR response). Neither
    // sets `Cache-Control`, so Cloudflare serves them DYNAMIC today and nothing
    // is shared. If a path-based Cache Rule is ever added for `/publicar-*`
    // (HOS-128), it MUST bypass on the auth cookie, or one visitor's prefilled
    // form gets served to the next.
    'publicar-restaurante',
    'publicar-experiencia'
] as const;

/**
 * URL path prefixes that should bypass middleware entirely.
 * These are internal Astro/Vite asset routes and common static files.
 */
export const STATIC_PREFIXES = ['/_astro/', '/favicon', '/api/'] as const;

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
 *
 * The commerce lead pages (`publicar-restaurante`, `publicar-experiencia`) are
 * deliberately NOT here (HOS-295). They are a top-of-funnel capture form that
 * creates no entity under the visitor's account and works fully anonymously;
 * bouncing a signed-in visitor with an incomplete profile off them would leave
 * them strictly worse off than a logged-out one, who can just submit.
 */
export const PROFILE_COMPLETION_REQUIRED_SESSION_OPTIONAL_SEGMENTS = ['publicar'] as const;
