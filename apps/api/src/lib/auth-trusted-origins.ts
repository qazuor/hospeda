/**
 * Trusted-origins parser for Better Auth.
 *
 * Split out of `auth.ts` so unit tests (apps/api/test/lib/
 * auth.parseTrustedOrigins.test.ts) can import this module without
 * pulling in @repo/email, @repo/db, bcryptjs, and the entire Better
 * Auth dependency graph that `auth.ts` brings along.
 *
 * @module auth-trusted-origins
 * @see SPEC-103 T-055
 */

/**
 * Inputs required by {@link parseTrustedOriginsFromConfig}. Kept as a
 * plain config object so tests can pass any combination of values
 * without mocking `env` or `logger` modules.
 */
export interface TrustedOriginsConfig {
    /** Value of `HOSPEDA_SITE_URL` at call time. */
    readonly siteUrl: string | undefined;
    /** Value of `HOSPEDA_ADMIN_URL` at call time. */
    readonly adminUrl: string | undefined;
    /** Comma-separated `HOSPEDA_EXTRA_TRUSTED_ORIGINS` value. */
    readonly extraOrigins: string | undefined;
    /** Active runtime mode. Production refuses to fall back to localhost. */
    readonly nodeEnv: string | undefined;
    /** Callback invoked once per rejected extra-origin entry. */
    readonly onWarn: (warning: { value: string; reason: string }) => void;
}

/**
 * Pure parser for the trusted-origins env vars. Given a config object,
 * returns the final list of origins Better Auth should accept.
 *
 * Behaviour (verified by SPEC-103 T-055 tests):
 * - `siteUrl` and `adminUrl` are pushed verbatim when set (no validation).
 * - `extraOrigins` is split on `,`, trimmed, deduplicated against the
 *   running list, validated as `http(s)` URLs, and warnings are emitted
 *   for entries that are malformed or use a non-http(s) scheme. Empty
 *   entries from trailing commas are skipped silently.
 * - When no origin was configured, localhost defaults are appended
 *   (NODE_ENV !== 'production'), or the function throws (production).
 */
export function parseTrustedOriginsFromConfig(config: TrustedOriginsConfig): string[] {
    const { siteUrl, adminUrl, extraOrigins, nodeEnv, onWarn } = config;
    const origins: string[] = [];

    if (siteUrl) {
        origins.push(siteUrl);
    }

    if (adminUrl) {
        origins.push(adminUrl);
    }

    // Extra origins via comma-separated env var. Used for aliases like
    // staging.hospeda.com.ar / staging-admin.hospeda.com.ar where the
    // canonical HOSPEDA_SITE_URL stays at the prod-naming hostname but
    // the same containers also serve a staging hostname that needs to
    // be a trusted origin for sign-up and OAuth flows.
    //
    // Each entry must be a full URL (with scheme). Better Auth expects
    // origin format like `https://example.com`; bare hostnames are
    // silently rejected by some validation paths and may also break the
    // CORS plumbing downstream. Validate the format up front and warn
    // on malformed entries instead of pushing them silently.
    if (extraOrigins) {
        for (const raw of extraOrigins.split(',')) {
            const value = raw.trim();
            if (value.length === 0 || origins.includes(value)) continue;
            try {
                const parsed = new URL(value);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    onWarn({
                        value,
                        reason: `non-http(s) scheme: ${parsed.protocol}`
                    });
                    continue;
                }
                origins.push(value);
            } catch {
                onWarn({
                    value,
                    reason: 'malformed URL (must be a full URL like https://staging.hospeda.com.ar)'
                });
            }
        }
    }

    // Default development origins
    if (origins.length === 0) {
        if (nodeEnv === 'production') {
            throw new Error(
                'HOSPEDA_SITE_URL and HOSPEDA_ADMIN_URL must be configured in production. ' +
                    'Cannot fall back to localhost origins in production environment.'
            );
        }
        origins.push('http://localhost:3000', 'http://localhost:4321');
    }

    return origins;
}
