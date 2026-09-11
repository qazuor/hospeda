/**
 * @file verification-callback.ts
 * @description Resolves the URL that goes into the account-verification email.
 *
 * Better Auth hands `sendVerificationEmail` a ready-made `url` of the shape
 * `{apiOrigin}/api/auth/verify-email?token=…&callbackURL=…`, where `callbackURL`
 * is whatever the client passed to `signUp.email`. That value has already been
 * validated against `trustedOrigins` by Better Auth's own origin-check
 * middleware, so it is safe to forward — a hostile absolute URL never reaches
 * this point.
 *
 * Forwarding it is what closes HOS-838: the destination the person was heading
 * for is otherwise lost at the verification hop, because it lives only in the
 * browser that submitted the form and the email is opened later, possibly on
 * another device.
 *
 * When the client passed nothing, Better Auth substitutes the bare `"/"`, which
 * would resolve against the API origin and land the user on a host that serves
 * no pages. That case falls back to the web sign-in screen, which is where this
 * flow pointed before the destination was carried at all.
 */

/** Better Auth's stand-in when the caller supplied no `callbackURL`. */
const BETTER_AUTH_DEFAULT_CALLBACK = '/';

/** Input for {@link resolveVerificationUrl}. */
export interface ResolveVerificationUrlInput {
    /** The `url` Better Auth built for this verification, including its token. */
    readonly url: string;
    /** Origin of the public web app, e.g. `https://hospeda.com.ar` (no trailing slash). */
    readonly siteOrigin: string;
}

/**
 * Returns the verification URL to put in the email.
 *
 * Keeps Better Auth's `url` — token included — and only replaces its
 * `callbackURL` when the client did not provide a usable one.
 *
 * @param input - See {@link ResolveVerificationUrlInput}.
 * @returns The URL to send, with a `callbackURL` that resolves on the web app.
 *
 * @example
 * ```typescript
 * resolveVerificationUrl({
 *   url: 'https://api.example.com/api/auth/verify-email?token=t&callbackURL=%2F',
 *   siteOrigin: 'https://example.com'
 * });
 * // → '…?token=t&callbackURL=https%3A%2F%2Fexample.com%2Fes%2Fauth%2Fsignin%3Fverified%3D1'
 * ```
 */
export function resolveVerificationUrl(input: ResolveVerificationUrlInput): string {
    const { url, siteOrigin } = input;
    const normalizedSiteOrigin = siteOrigin.replace(/\/$/, '');
    const fallbackCallback = `${normalizedSiteOrigin}/es/auth/signin?verified=1`;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // A malformed `url` is not something to paper over silently, but an
        // account-verification email that cannot be sent is worse than one that
        // lands on the sign-in screen.
        return fallbackCallback;
    }

    const callbackUrl = parsed.searchParams.get('callbackURL');

    // A relative callback would resolve against the API origin, which serves no
    // pages. Only an absolute URL is usable here, and Better Auth has already
    // checked it against `trustedOrigins`.
    const isUsable =
        callbackUrl !== null &&
        callbackUrl !== BETTER_AUTH_DEFAULT_CALLBACK &&
        /^https?:\/\//.test(callbackUrl);

    if (!isUsable) {
        parsed.searchParams.set('callbackURL', fallbackCallback);
    }

    return parsed.toString();
}
