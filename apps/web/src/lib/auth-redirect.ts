import type { SupportedLocale } from './i18n';
import { buildUrl } from './urls';

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

/**
 * Resolve the post-auth destination carried by a `returnUrl` / `redirect` query
 * param down to a path that is safe to hand to `Astro.redirect`.
 *
 * ## Why this is a shared function and not two inline checks
 *
 * `signin.astro` has enforced this rule since SPEC-182 and `signup.astro` needs
 * exactly the same one now that it honours a return destination too (HOS-810).
 * The check is a security boundary, not a formatting preference: the naive
 * `new URL(raw, origin)` resolution does NOT enforce the base origin when `raw`
 * is itself absolute — it returns the absolute URL verbatim — which is a
 * textbook open-redirect usable for phishing. A second, hand-copied version of
 * that predicate is the kind of thing that drifts one clause at a time, so
 * there is one.
 *
 * Accepts only an obviously-safe relative path: a single leading slash, no
 * second slash that a browser would parse as the `//evil.com` protocol-relative
 * form, and no backslash variant of it. Anything else — including an empty
 * value, an absolute URL, or a scheme prefix — falls back to the account
 * dashboard rather than being rejected loudly, because this runs on ordinary
 * navigation and a hard error would be worse than landing one page away.
 *
 * @param params.rawReturn - The raw, attacker-controlled query value. May be empty.
 * @param params.locale - Locale used to build the fallback destination.
 * @returns A same-origin relative path, always beginning with `/{locale}` when
 *   the input was rejected.
 *
 * @example
 * ```ts
 * resolveSafeReturnPath({ rawReturn: '/es/mi-cuenta/comercio/nuevo/experience/', locale: 'es' })
 * // => '/es/mi-cuenta/comercio/nuevo/experience/'
 * resolveSafeReturnPath({ rawReturn: '//evil.com', locale: 'es' })
 * // => '/es/mi-cuenta/'
 * ```
 */
export function resolveSafeReturnPath({
    rawReturn,
    locale
}: {
    readonly rawReturn: string;
    readonly locale: SupportedLocale;
}): string {
    const isSafeRelativePath =
        rawReturn.startsWith('/') && !rawReturn.startsWith('//') && !rawReturn.startsWith('/\\');

    return isSafeRelativePath ? rawReturn : buildUrl({ locale, path: 'mi-cuenta' });
}
