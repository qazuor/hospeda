/**
 * Better Auth handler route with brute-force lockout protection.
 *
 * Mounts lockout-protected handlers BEFORE the Better Auth catch-all.
 * Protected endpoints:
 *   - POST /sign-in/email     — checks + records failed attempts per email
 *   - POST /forget-password   — records every attempt per (email, IP) pair
 *   - POST /sign-up/email     — records every attempt per (email, IP) pair
 *   - POST /send-verification-email — records every attempt per (email, IP) pair
 *
 * All other auth endpoints pass through to the Better Auth catch-all unaffected.
 *
 * @module auth-handler
 */

import { getAuth } from '../../lib/auth';
import { Sentry } from '../../lib/sentry';
import {
    checkLockout,
    checkLockoutByKey,
    recordFailedAttempt,
    recordFailedAttemptByKey,
    resetLockout
} from '../../middlewares/auth-lockout';
import { getClientIp } from '../../middlewares/rate-limit';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';

/**
 * Lockout configuration for the forgot-password endpoint.
 * Uses a composite key (email + IP) to limit abuse without locking
 * an email address across all IPs.
 *
 * 5 attempts per 15-minute window per (email, IP) pair.
 */
const FORGOT_PASSWORD_LOCKOUT_CONFIG = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000 // 15 minutes in ms
} as const;

/**
 * Lockout configuration for the sign-up endpoint.
 * Uses a composite key (email + IP) to prevent automated account creation
 * from a single source without globally blocking the email.
 *
 * 10 attempts per 15-minute window per (email, IP) pair.
 * Higher threshold than sign-in to accommodate legitimate retries
 * (e.g., typos in name/password fields before successful registration).
 */
const SIGNUP_LOCKOUT_CONFIG = {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000 // 15 minutes in ms
} as const;

/**
 * Lockout configuration for the send-verification-email endpoint.
 * Prevents email-flooding attacks where an attacker repeatedly triggers
 * verification emails to valid or invalid addresses.
 *
 * 5 attempts per 15-minute window per (email, IP) pair.
 */
const RESEND_VERIFICATION_LOCKOUT_CONFIG = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000 // 15 minutes in ms
} as const;

const app = createRouter();

/**
 * Lockout-protected signin handler.
 * MUST be registered BEFORE the catch-all so Hono matches it first.
 *
 * Intercepts only POST /sign-in/email. All other auth routes pass through.
 */
app.post('/sign-in/email', async (c) => {
    // 1. Clone the request to read body without consuming it
    const clonedRequest = c.req.raw.clone();
    let email: string | undefined;

    try {
        const body = await clonedRequest.json();
        email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    } catch {
        // Body parse failed, let Better Auth handle the error
    }

    // 2. Check lockout (if email was extracted)
    // Wrapped in try/catch: lockout failure must NEVER break the login flow.
    if (email) {
        try {
            const { locked, retryAfter } = await checkLockout({ email });
            if (locked) {
                const minutes = Math.ceil(retryAfter / 60);
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOCKOUT,
                    email,
                    ip: getClientIp({ c }),
                    attemptNumber: 0,
                    retryAfter
                });
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'ACCOUNT_LOCKED',
                            message: `Too many failed login attempts. Please try again in ${minutes} minutes or use password reset.`,
                            retryAfter
                        }
                    },
                    429,
                    {
                        'Retry-After': String(retryAfter)
                    }
                );
            }
        } catch (lockoutError) {
            apiLogger.warn(
                { email, error: lockoutError },
                'Lockout check failed, proceeding without lockout protection'
            );
        }
    }

    // 3. Forward ORIGINAL request to Better Auth (not the clone)
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);

    // 4. Check for Better Auth's own rate limit (429)
    // Better Auth rate-limits /sign-in/email at 3 req/10s.
    // Return as-is WITHOUT counting as a failed login attempt.
    if (response.status === 429) {
        return response;
    }

    // 5. Record result (if email was extracted)
    // Wrapped in try/catch: recording failure must not affect the login response.
    if (email) {
        try {
            let isLoginSuccess = response.status === 200;

            // Defensive safety net: check for error in body (Better Auth issue #7035).
            // Hono preserves status codes correctly, so this is unlikely to trigger.
            if (isLoginSuccess) {
                try {
                    const clonedResponse = response.clone();
                    const responseBody = await clonedResponse.json();
                    if (responseBody?.error || responseBody?.code === 'INVALID_EMAIL_OR_PASSWORD') {
                        isLoginSuccess = false;
                    }
                } catch {
                    // If body parse fails, trust the HTTP status code
                }
            }

            if (isLoginSuccess) {
                await resetLockout({ email });
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOGIN_SUCCESS,
                    email,
                    ip: getClientIp({ c })
                });
            } else {
                const result = await recordFailedAttempt({ email });
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOGIN_FAILED,
                    email,
                    ip: getClientIp({ c }),
                    reason: 'invalid_credentials',
                    attemptNumber: result.attemptNumber,
                    locked: result.locked
                });
            }
        } catch (lockoutError) {
            apiLogger.warn({ email, error: lockoutError }, 'Failed to record lockout attempt');
        }
    }

    return response;
});

/**
 * Lockout-protected forgot-password handler.
 * MUST be registered BEFORE the catch-all so Hono matches it first.
 *
 * Uses a composite lockout key (email:ip) to prevent enumeration attacks
 * while allowing the same email to be tried from different IPs.
 * Threshold: 5 attempts per 15-minute window per (email, IP) pair.
 */
// Better Auth's actual route name is `/request-password-reset`. The
// historical `/forget-password` here NEVER matched Better Auth's
// internal router, so the lockout-protected wrapper silently returned
// Better Auth's 404 for every legitimate password-reset request.
// Discovered 2026-05-14 during SPEC-103 T-017 smoke.
app.post('/request-password-reset', async (c) => {
    const ip = getClientIp({ c });

    // 1. Parse email from request body
    const clonedRequest = c.req.raw.clone();
    let email: string | undefined;

    try {
        const body = await clonedRequest.json();
        email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    } catch {
        // Body parse failed — let Better Auth handle the error
    }

    // 2. Check lockout using composite key (email:ip)
    // Wrapped in try/catch: lockout failure must NEVER break the password reset flow.
    if (email) {
        const lockoutKey = `forgot-password:${email}:${ip}`;

        try {
            const { locked, retryAfter } = await checkLockoutByKey({
                key: lockoutKey,
                config: FORGOT_PASSWORD_LOCKOUT_CONFIG
            });

            if (locked) {
                const minutes = Math.ceil(retryAfter / 60);
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOCKOUT,
                    email,
                    ip,
                    attemptNumber: FORGOT_PASSWORD_LOCKOUT_CONFIG.maxAttempts,
                    retryAfter
                });
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'TOO_MANY_REQUESTS',
                            message: `Too many password reset attempts. Please try again in ${minutes} minutes.`,
                            retryAfter
                        }
                    },
                    429,
                    {
                        'Retry-After': String(retryAfter)
                    }
                );
            }
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Forgot-password lockout check failed, proceeding without lockout protection'
            );
        }
    }

    // 3. Forward ORIGINAL request to Better Auth
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);

    // 4. Record every request as an attempt (Better Auth always returns 200
    //    for this endpoint regardless of whether the email exists, to prevent
    //    enumeration). Only count non-429 responses from Better Auth.
    if (email && response.status !== 429) {
        const lockoutKey = `forgot-password:${email}:${ip}`;

        try {
            await recordFailedAttemptByKey({
                key: lockoutKey,
                config: FORGOT_PASSWORD_LOCKOUT_CONFIG
            });
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Failed to record forgot-password lockout attempt'
            );
        }
    }

    return response;
});

/**
 * Lockout-protected sign-up handler.
 * MUST be registered BEFORE the catch-all so Hono matches it first.
 *
 * Uses a composite lockout key (email:ip) to prevent bulk account creation
 * from a single source while not globally blocking a specific email.
 * Threshold: 10 attempts per 15-minute window per (email, IP) pair.
 *
 * Every attempt (success or failure) is counted because:
 * - Successful signups can still be part of an automated wave.
 * - Better Auth returns a 200 body for both success and conflict (409-style
 *   errors are still delivered as 200 with an error payload in some versions).
 *
 * We intentionally do NOT reset the lockout counter on successful signup
 * because there is no legitimate reason to register 10+ accounts from the
 * same (email, IP) pair within a short window.
 */
app.post('/sign-up/email', async (c) => {
    const ip = getClientIp({ c });

    // 1. Parse email from request body
    const clonedRequest = c.req.raw.clone();
    let email: string | undefined;

    try {
        const body = await clonedRequest.json();
        email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    } catch {
        // Body parse failed — let Better Auth handle the error
    }

    // 2. Check lockout using composite key (email:ip)
    // Wrapped in try/catch: lockout failure must NEVER break the signup flow.
    if (email) {
        const lockoutKey = `signup:${email}:${ip}`;

        try {
            const { locked, retryAfter } = await checkLockoutByKey({
                key: lockoutKey,
                config: SIGNUP_LOCKOUT_CONFIG
            });

            if (locked) {
                const minutes = Math.ceil(retryAfter / 60);
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOCKOUT,
                    email,
                    ip,
                    attemptNumber: SIGNUP_LOCKOUT_CONFIG.maxAttempts,
                    retryAfter
                });
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'TOO_MANY_REQUESTS',
                            message: `Too many sign-up attempts. Please try again in ${minutes} minutes.`,
                            retryAfter
                        }
                    },
                    429,
                    {
                        'Retry-After': String(retryAfter)
                    }
                );
            }
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Sign-up lockout check failed, proceeding without lockout protection'
            );
        }
    }

    // 3. Forward ORIGINAL request to Better Auth
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);

    // 4. Record every request as an attempt (skip Better Auth's own 429 responses
    //    to avoid double-counting when Better Auth's built-in rate limiter fires).
    if (email && response.status !== 429) {
        const lockoutKey = `signup:${email}:${ip}`;

        try {
            await recordFailedAttemptByKey({
                key: lockoutKey,
                config: SIGNUP_LOCKOUT_CONFIG
            });
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Failed to record sign-up lockout attempt'
            );
        }
    }

    return response;
});

/**
 * Lockout-protected send-verification-email handler.
 * MUST be registered BEFORE the catch-all so Hono matches it first.
 *
 * Prevents email-flooding attacks where an attacker repeatedly requests
 * verification emails for an address they do not own.
 * Uses a composite key (email:ip) so the same email can be retried
 * from a different IP (e.g., user changes network) without being blocked.
 *
 * Threshold: 5 attempts per 15-minute window per (email, IP) pair.
 *
 * Every attempt is counted regardless of outcome because Better Auth always
 * returns 200 for this endpoint to prevent email enumeration.
 */
app.post('/send-verification-email', async (c) => {
    const ip = getClientIp({ c });

    // 1. Parse email from request body
    const clonedRequest = c.req.raw.clone();
    let email: string | undefined;

    try {
        const body = await clonedRequest.json();
        email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    } catch {
        // Body parse failed — let Better Auth handle the error
    }

    // 2. Check lockout using composite key (email:ip)
    // Wrapped in try/catch: lockout failure must NEVER break the resend flow.
    if (email) {
        const lockoutKey = `resend:${email}:${ip}`;

        try {
            const { locked, retryAfter } = await checkLockoutByKey({
                key: lockoutKey,
                config: RESEND_VERIFICATION_LOCKOUT_CONFIG
            });

            if (locked) {
                const minutes = Math.ceil(retryAfter / 60);
                auditLog({
                    auditEvent: AuditEventType.AUTH_LOCKOUT,
                    email,
                    ip,
                    attemptNumber: RESEND_VERIFICATION_LOCKOUT_CONFIG.maxAttempts,
                    retryAfter
                });
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'TOO_MANY_REQUESTS',
                            message: `Too many verification email requests. Please try again in ${minutes} minutes.`,
                            retryAfter
                        }
                    },
                    429,
                    {
                        'Retry-After': String(retryAfter)
                    }
                );
            }
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Send-verification-email lockout check failed, proceeding without lockout protection'
            );
        }
    }

    // 3. Forward ORIGINAL request to Better Auth
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);

    // 4. Record every request as an attempt (skip Better Auth's own 429 responses
    //    to avoid double-counting when Better Auth's built-in rate limiter fires).
    if (email && response.status !== 429) {
        const lockoutKey = `resend:${email}:${ip}`;

        try {
            await recordFailedAttemptByKey({
                key: lockoutKey,
                config: RESEND_VERIFICATION_LOCKOUT_CONFIG
            });
        } catch (lockoutError) {
            apiLogger.warn(
                { email, ip, error: lockoutError },
                'Failed to record send-verification-email lockout attempt'
            );
        }
    }

    return response;
});

/**
 * Result of inspecting a Better Auth response for an OAuth callback failure.
 *
 * Returned by {@link extractOAuthErrorFromCallback} when the request was an
 * OAuth callback (e.g. `/api/auth/callback/google`) AND Better Auth emitted
 * a 302 redirect carrying `?error=<code>` on the Location header.
 *
 * @see SPEC-120
 */
export interface OAuthCallbackError {
    /** Provider name extracted from the request path (e.g. `google`, `facebook`). */
    readonly provider: string;
    /**
     * Sanitized error code — guaranteed to match `/^[a-z_]{1,64}$/`. Falls
     * back to `'unknown'` when the provider sends an unexpected code so the
     * value is safe to use as a Sentry tag and an i18n key suffix.
     */
    readonly errorCode: string;
    /** Original `error` query value (before sanitization). */
    readonly errorCodeRaw: string;
    /** Optional free-form description (provider-supplied, never i18n-translated). */
    readonly errorDescription: string | undefined;
    /** Parsed Location URL the redirect points to (with original + sanitized params). */
    readonly locationUrl: URL;
    /** RAW query the provider sent to our callback (minus `state` noise). */
    readonly providerRawQuery: Readonly<Record<string, string>>;
    /** Query Better Auth re-emits on the Location header to the web app. */
    readonly redirectQuery: Readonly<Record<string, string>>;
}

/**
 * Inspects a request URL + Better Auth response to decide whether it's an
 * OAuth callback failure that should be observed (Sentry + Location rewrite).
 *
 * Pure function — no side effects. Tested in isolation.
 *
 * @returns OAuthCallbackError when the response is a 302 from a `/callback/<provider>`
 *          path carrying `?error=` in Location; null otherwise.
 *
 * @see SPEC-120 Phase 0 catalog for the exact query string contract.
 */
export function extractOAuthErrorFromCallback({
    requestUrl,
    response
}: {
    readonly requestUrl: URL;
    readonly response: Response;
}): OAuthCallbackError | null {
    if (response.status !== 302) {
        return null;
    }

    const callbackMatch = requestUrl.pathname.match(/\/callback\/([a-z]+)\/?$/);
    if (!callbackMatch?.[1]) {
        return null;
    }
    const provider = callbackMatch[1];

    const location = response.headers.get('Location');
    if (!location) {
        return null;
    }

    let locationUrl: URL;
    try {
        locationUrl = new URL(location);
    } catch {
        return null;
    }

    const errorCodeRaw = locationUrl.searchParams.get('error');
    if (!errorCodeRaw) {
        return null;
    }

    const errorCode = /^[a-z_]{1,64}$/.test(errorCodeRaw) ? errorCodeRaw : 'unknown';
    const errorDescription = locationUrl.searchParams.get('error_description') ?? undefined;

    // Strip `state` — opaque random string, no debugging value, just noise in Sentry.
    const providerRawQuery: Record<string, string> = {};
    for (const [key, value] of requestUrl.searchParams.entries()) {
        if (key === 'state') {
            continue;
        }
        providerRawQuery[key] = value;
    }

    const redirectQuery: Record<string, string> = {};
    for (const [key, value] of locationUrl.searchParams.entries()) {
        redirectQuery[key] = value;
    }

    return {
        provider,
        errorCode,
        errorCodeRaw,
        errorDescription,
        locationUrl,
        providerRawQuery,
        redirectQuery
    };
}

/**
 * Observes OAuth callback failures: emits a Sentry event when Better Auth's
 * response is a 302 to `errorCallbackURL` carrying `?error=<code>`, and
 * idempotently rewrites the `Location` header to inject `&provider=<name>`
 * so the web app can render a provider-aware banner.
 *
 * Pure function over (request URL, user-agent, response) — no Hono dependency,
 * so it can be unit-tested without spinning up the whole app. Returns the
 * original response unchanged for the happy path (non-OAuth-error, non-302,
 * non-callback path) — zero overhead in those cases.
 *
 * @see SPEC-120
 */
export function maybeObserveOAuthFailure({
    requestUrl,
    userAgent,
    response
}: {
    readonly requestUrl: URL;
    readonly userAgent: string | undefined;
    readonly response: Response;
}): Response {
    const oauthError = extractOAuthErrorFromCallback({ requestUrl, response });

    if (!oauthError) {
        return response;
    }

    const {
        provider,
        errorCode,
        errorCodeRaw,
        errorDescription,
        locationUrl,
        providerRawQuery,
        redirectQuery
    } = oauthError;

    // `access_denied` is user-cancel — expected, recoverable, low signal-to-noise as `error`.
    // Everything else is a provider/system failure that operators should triage.
    const level: 'warning' | 'error' = errorCode === 'access_denied' ? 'warning' : 'error';

    Sentry.captureMessage(`OAuth ${provider} signin failed: ${errorCode}`, {
        level,
        tags: {
            module: 'auth.oauth',
            provider,
            error_code: errorCode
        },
        extra: {
            error_code_raw: errorCodeRaw,
            error_description: errorDescription,
            provider_raw_query: providerRawQuery,
            redirect_query: redirectQuery,
            redirect_location: locationUrl.toString(),
            request_id: response.headers.get('x-request-id') ?? undefined,
            user_agent: userAgent
        }
    });

    // Idempotent provider rewrite: skip if Better Auth (or a future version)
    // already includes provider, so a re-deploy with this wrapper doesn't
    // double-stamp the query.
    if (locationUrl.searchParams.has('provider')) {
        return response;
    }

    locationUrl.searchParams.set('provider', provider);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Location', locationUrl.toString());

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

/**
 * Catch-all handler that delegates to Better Auth and observes OAuth failures.
 * MUST come AFTER all specific route handlers above.
 *
 * @see {@link maybeObserveOAuthFailure} for the observation logic.
 */
app.on(['GET', 'POST'], '/*', async (c) => {
    const auth = getAuth();
    const response = await auth.handler(c.req.raw);
    return maybeObserveOAuthFailure({
        requestUrl: new URL(c.req.url),
        userAgent: c.req.header('user-agent'),
        response
    });
});

export { app as betterAuthHandler };
