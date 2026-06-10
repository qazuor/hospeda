import type { SupportedLocale } from './i18n';

/**
 * Builds a redirect URL to the login page with a return URL parameter.
 *
 * Pure, dependency-free helper kept in its OWN module (separate from
 * `middleware-helpers.ts`) so it is safe to import from client React islands.
 * `middleware-helpers.ts` is server-only — it pulls in `@repo/logger`,
 * `@sentry/astro`, and `process.env` access, which crash on hydration when
 * dragged into a browser bundle. Importing `buildLoginRedirect` from here keeps
 * islands free of that server surface. `middleware-helpers.ts` re-exports this
 * function for server consumers, so the single source of truth is preserved.
 *
 * @param params - Object with locale and the current URL to redirect back to after login
 * @returns Absolute path to the signin page with returnUrl encoded as a query param
 *
 * @example
 * ```ts
 * buildLoginRedirect({ locale: 'es', currentUrl: '/es/mi-cuenta/perfil/' })
 * // => '/es/auth/signin/?returnUrl=%2Fes%2Fmi-cuenta%2Fperfil%2F'
 * ```
 */
export function buildLoginRedirect({
    locale,
    currentUrl
}: {
    locale: SupportedLocale;
    currentUrl: string;
}): string {
    const encodedReturnUrl = encodeURIComponent(currentUrl);
    return `/${locale}/auth/signin/?returnUrl=${encodedReturnUrl}`;
}
