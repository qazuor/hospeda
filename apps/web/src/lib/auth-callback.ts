/**
 * @file auth-callback.ts
 * @description Server-side allowlist validation for the cross-app `callbackUrl`
 * redirect param (SPEC-182 Phase 1).
 *
 * The web signin/signup pages are the unified auth surface for both the public
 * site and the admin panel. When the admin guard bounces an unauthenticated
 * user to the web signin, it appends `?callbackUrl={admin-url}`. After a
 * successful signin the server redirects the browser to that `callbackUrl`.
 *
 * Because `callbackUrl` is attacker-controllable (anyone can craft a signin
 * link), it MUST be validated against a strict allowlist before being used as a
 * redirect target — otherwise it is an open-redirect (and, with OAuth in the
 * loop, a token-leak) vector.
 *
 * Validation is performed against the URL's parsed `hostname`, never against the
 * raw string. String/regex matching on the raw value is exploitable by:
 *   - suffix hosts:        `https://hospeda.com.ar.evil.com`
 *   - embedded paths:      `https://evil.com/hospeda.com.ar`
 *   - userinfo `@` tricks:  `https://hospeda.com.ar@evil.com`
 * Parsing with the WHATWG `URL` and inspecting `hostname` defeats all three.
 */

/** Production apex domain whose subdomains share the cross-subdomain session cookie. */
const PROD_APEX = 'hospeda.com.ar';

/** Local development apex used by the `*.hospeda.local` cookie recipe (SPEC-182 Phase 5). */
const DEV_APEX = 'hospeda.local';

/**
 * Arguments for {@link validateCallbackUrl}.
 *
 * The function is pure: all environment context is injected so it can be unit
 * tested without touching `import.meta.env`. Resolve these at the call site via
 * `getSiteUrl()`, `getAdminUrl()`, and `isProduction()` from `src/lib/env.ts`.
 */
export interface ValidateCallbackUrlArgs {
    /** The untrusted candidate redirect URL (raw query-param value). */
    readonly url: string;
    /** The web site origin (e.g. `https://hospeda.com.ar` or `http://localhost:4321`). */
    readonly siteUrl: string;
    /** The admin app origin, or `undefined` when not configured. */
    readonly adminUrl: string | undefined;
    /** Whether the app is running in production (gates dev-only hosts). */
    readonly isProduction: boolean;
}

/**
 * Safely extracts the lowercased origin of a configured base URL.
 *
 * @param raw - A trusted base URL string (may be undefined/malformed)
 * @returns The origin (`scheme://host[:port]`), or null if it cannot be parsed
 */
function safeOrigin(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    try {
        return new URL(raw).origin;
    } catch {
        return null;
    }
}

/**
 * Checks whether a hostname is the given apex domain or one of its subdomains.
 *
 * Uses exact match or a `.{apex}` suffix so that `hospeda.com.ar.evil.com` does
 * NOT match (its hostname does not end with `.hospeda.com.ar`).
 *
 * @param hostname - The parsed, lowercased URL hostname
 * @param apex - The apex domain to match against
 * @returns True when the hostname is the apex or a subdomain of it
 */
function isHostOfDomain(hostname: string, apex: string): boolean {
    return hostname === apex || hostname.endsWith(`.${apex}`);
}

/**
 * Validates an untrusted `callbackUrl` against the Hospeda redirect allowlist.
 *
 * A URL is accepted only when ALL of the following hold:
 *   1. It parses as an absolute `http:`/`https:` URL.
 *   2. Its real host (parsed `hostname`) is one of:
 *      - the configured site origin, or the configured admin origin (exact); or
 *      - `hospeda.com.ar` or any of its subdomains (production cross-subdomain); or
 *      - `localhost` / `hospeda.local` (+ subdomains) — DEVELOPMENT ONLY.
 *
 * Any other value (external domain, non-http protocol, relative/protocol-relative
 * URL, malformed input) returns `null` and the caller must fall back to a safe
 * default destination (the locale root). The candidate is NEVER followed.
 *
 * @param args - {@link ValidateCallbackUrlArgs}
 * @returns The original `url` string when allowed, or `null` when rejected
 *
 * @example
 * ```ts
 * validateCallbackUrl({
 *   url: 'https://admin.hospeda.com.ar/dashboard',
 *   siteUrl: 'https://hospeda.com.ar',
 *   adminUrl: 'https://admin.hospeda.com.ar',
 *   isProduction: true
 * }); // => 'https://admin.hospeda.com.ar/dashboard'
 *
 * validateCallbackUrl({ url: 'https://evil.example.com', siteUrl, adminUrl, isProduction });
 * // => null
 * ```
 */
export function validateCallbackUrl({
    url,
    siteUrl,
    adminUrl,
    isProduction
}: ValidateCallbackUrlArgs): string | null {
    if (!url || url.trim().length === 0) {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // Relative paths, protocol-relative `//host`, and garbage all throw here.
        return null;
    }

    // Only http(s) redirects are ever allowed (blocks javascript:, data:, etc.).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Exact match against the configured site / admin origins.
    const allowedOrigins = [safeOrigin(siteUrl), safeOrigin(adminUrl)].filter(
        (origin): origin is string => origin !== null
    );
    if (allowedOrigins.includes(parsed.origin)) {
        return url;
    }

    // 2. Production: hospeda.com.ar and any subdomain.
    if (isHostOfDomain(hostname, PROD_APEX)) {
        return url;
    }

    // 3. Development only: localhost and *.hospeda.local.
    if (!isProduction && (hostname === 'localhost' || isHostOfDomain(hostname, DEV_APEX))) {
        return url;
    }

    return null;
}
