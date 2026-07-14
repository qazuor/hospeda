/**
 * @file internal-bypass-selfcheck.ts
 * @description Pure startup self-check for the SSR internal-request rate-limit
 * bypass (HOS-103 / HOS-155).
 *
 * Background (the incident this prevents): on 2026-07-13 `hospeda-web-prod` had
 * `HOSPEDA_INTERNAL_REQUEST_SECRET` set but `HOSPEDA_INTERNAL_API_URL` UNSET.
 * `getInternalApiUrl()` returning `undefined` silently disables the
 * `X-Internal-Request` bypass header (see `src/lib/api/client.ts`), so ALL SSR
 * traffic collapsed onto the public per-IP rate-limit bucket and the site
 * mass-429'd. Both env vars are `.optional()` in Zod, so nothing failed at
 * startup — the failure was 100% silent.
 *
 * This module only decides WHETHER the current config is coherent; it never
 * logs, never touches Sentry, and never reads `import.meta.env` itself, so it
 * stays trivially unit-testable. The caller (`src/middleware.ts`) is
 * responsible for reading the env, calling this function, and alerting.
 */

/**
 * Result of the internal-bypass config self-check.
 */
export interface InternalBypassCheckResult {
    /**
     * `'ok'` when both values are present (or the check does not apply),
     * `'skipped'` when the check does not apply (non-production), or
     * `'misconfigured'` when the bypass is silently broken in production.
     */
    readonly status: 'ok' | 'skipped' | 'misconfigured';
    /** Human-readable explanation, only set when `status === 'misconfigured'`. */
    readonly reason?: string;
}

/**
 * Validates that the SSR internal-request rate-limit bypass is coherently
 * configured for the current environment.
 *
 * Rules:
 * - Outside production, the check never applies (dev/build never alerts) —
 *   returns `{ status: 'skipped' }`.
 * - In production, with both `internalApiUrl` and `internalRequestSecret`
 *   present, the bypass is correctly configured — returns `{ status: 'ok' }`.
 * - In production, with only one of the two present, the bypass is silently
 *   disabled (this is exactly the HOS-155 incident shape) — returns
 *   `{ status: 'misconfigured', reason }` naming the missing variable.
 * - In production, with both missing, the bypass was never configured at all
 *   — returns `{ status: 'misconfigured', reason }`.
 *
 * Note: this function CANNOT and does not validate that this app's secret
 * actually MATCHES the API's configured secret — web has no visibility into
 * the API's env. That cross-app match check remains the job of the existing
 * `packages/config/src/env-cross-checks.ts` rule and is out of scope here.
 *
 * @param params - The two bypass env values to validate, plus whether the
 *   current environment is production.
 * @returns The check result: `ok`, `skipped`, or `misconfigured` with a reason.
 */
export function checkInternalBypassConfig({
    internalApiUrl,
    internalRequestSecret,
    isProd
}: {
    readonly internalApiUrl: string | undefined;
    readonly internalRequestSecret: string | undefined;
    readonly isProd: boolean;
}): InternalBypassCheckResult {
    if (!isProd) {
        return { status: 'skipped' };
    }

    const hasUrl = Boolean(internalApiUrl);
    const hasSecret = Boolean(internalRequestSecret);

    if (hasUrl && hasSecret) {
        return { status: 'ok' };
    }

    if (hasSecret && !hasUrl) {
        return {
            status: 'misconfigured',
            reason:
                'HOSPEDA_INTERNAL_API_URL is missing while HOSPEDA_INTERNAL_REQUEST_SECRET is ' +
                'set — SSR rate-limit bypass is silently OFF (HOS-155/HOS-103). All SSR traffic ' +
                'will be treated as public and collapse onto the shared per-IP rate limit.'
        };
    }

    if (hasUrl && !hasSecret) {
        return {
            status: 'misconfigured',
            reason:
                'HOSPEDA_INTERNAL_REQUEST_SECRET is missing while HOSPEDA_INTERNAL_API_URL is ' +
                'set — SSR rate-limit bypass is silently OFF (HOS-155/HOS-103). All SSR traffic ' +
                'will be treated as public and collapse onto the shared per-IP rate limit.'
        };
    }

    return {
        status: 'misconfigured',
        reason:
            'Both HOSPEDA_INTERNAL_API_URL and HOSPEDA_INTERNAL_REQUEST_SECRET are missing — ' +
            'the SSR rate-limit bypass is fully unconfigured in production (HOS-155/HOS-103). ' +
            'All SSR traffic will be rate-limited as public traffic.'
    };
}
