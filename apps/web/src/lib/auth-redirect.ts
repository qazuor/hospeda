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
 * form, no backslash variant of it, and no C0 control character anywhere in
 * the string (HOS-1170). The control-character check matters because the
 * three prefix checks above run on the raw string, but every consumer of this
 * function's return value eventually resolves it with the WHATWG URL parser
 * (e.g. `Astro.redirect`, `new URL(result, origin)`), and that parser STRIPS
 * tab/LF/CR anywhere in the string before parsing — not just at the edges.
 * That means `/\t/evil.com` passes all three prefix checks unchanged (it
 * starts with `/`, not `//`, not `/\`), but once a consumer resolves it the
 * tab vanishes and it collapses to `//evil.com`, which IS the protocol-relative
 * off-origin form the first check exists to reject. Rejecting any C0 control
 * char (code point < 0x20) closes that gap regardless of where it sits or
 * whether it happens to produce a literal `//` — mirrors the same guard in
 * `SafeReturnToSchema`
 * (`apps/api/src/routes/accommodation/protected/calendarConnectGoogle.ts`).
 * Anything rejected — including an empty value, an absolute URL, a scheme
 * prefix, or a control character — falls back to the account dashboard rather
 * than being rejected loudly, because this runs on ordinary navigation and a
 * hard error would be worse than landing one page away.
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
 * resolveSafeReturnPath({ rawReturn: '/\t/evil.com', locale: 'es' })
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
        rawReturn.startsWith('/') &&
        !rawReturn.startsWith('//') &&
        !rawReturn.startsWith('/\\') &&
        // Reject ANY C0 control char (charCode < 0x20): the WHATWG URL parser
        // strips tab/LF/CR anywhere in the string, so a value like
        // `/<TAB>/evil.com` would otherwise resolve off-origin. Checked by
        // code, not a literal-control regex, so no control byte lives in this
        // source file.
        ![...rawReturn].some((ch) => ch.charCodeAt(0) < 0x20);

    return isSafeRelativePath ? rawReturn : buildUrl({ locale, path: 'mi-cuenta' });
}
