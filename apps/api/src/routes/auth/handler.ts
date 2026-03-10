/**
 * Better Auth handler route with brute-force lockout protection.
 *
 * Mounts a lockout-protected signin handler BEFORE the Better Auth catch-all.
 * The lockout handler intercepts POST /sign-in/email to:
 * 1. Check if the email is locked out (too many failed attempts)
 * 2. Forward to Better Auth if not locked
 * 3. Record failed/successful login attempts
 * 4. Emit audit log entries for login events
 *
 * All other auth endpoints (signup, password reset, OAuth, etc.) pass through
 * to the Better Auth catch-all unaffected.
 *
 * @module auth-handler
 */

import { getAuth } from '../../lib/auth';
import { checkLockout, recordFailedAttempt, resetLockout } from '../../middlewares/auth-lockout';
import { getClientIp } from '../../middlewares/rate-limit';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';

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
 * Catch-all handler that delegates to Better Auth.
 * MUST come AFTER the specific /sign-in/email route.
 */
app.on(['GET', 'POST'], '/*', (c) => {
    const auth = getAuth();
    return auth.handler(c.req.raw);
});

export { app as betterAuthHandler };
