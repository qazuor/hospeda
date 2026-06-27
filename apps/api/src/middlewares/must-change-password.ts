/**
 * Must-Change-Password Gate Middleware (SPEC-239 T-041)
 *
 * Enforces a password-change requirement on ALL protected routes when the
 * authenticated user has `mustChangePassword = true` in their user record.
 * Commerce owner accounts are provisioned with this flag set to force the
 * owner to choose a personal password before accessing any protected feature.
 *
 * ## Behaviour
 * - If `mustChangePassword` is false (or missing) → pass through.
 * - If `mustChangePassword` is true → block with 403 + `PASSWORD_CHANGE_REQUIRED`.
 * - The change-password endpoint itself is EXEMPT so the user can actually fix it.
 * - In test mode (`HOSPEDA_ALLOW_MOCK_ACTOR = true`), an extra header
 *   `x-mock-must-change-password: true` overrides the flag so tests can simulate
 *   a locked account without a real DB row.
 *
 * ## Mount point
 * Apply this middleware AFTER `pastDueGraceMiddleware` on `/api/v1/protected/*`
 * so auth + actor resolution have already run. The exempt path list below must
 * be kept in sync with the change-password endpoint registration in
 * `routes/auth/index.ts`.
 *
 * @module middlewares/must-change-password
 */

import type { AppMiddleware } from '../types';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Path suffixes that are EXEMPT from the gate.
 * The change-password endpoints must be in this list so the user can clear
 * the flag without triggering the very gate they need to bypass.
 */
const EXEMPT_PATH_SUFFIXES = ['/auth/change-password', '/auth/change-password-required'] as const;

/**
 * Response body returned when the gate blocks a request.
 * Clients should redirect to the change-password screen on this code.
 */
const BLOCKED_RESPONSE = {
    error: {
        code: 'PASSWORD_CHANGE_REQUIRED',
        message:
            'You must change your password before accessing this resource. ' +
            'Please use the change-password endpoint to set a new password.'
    }
} as const;

/**
 * Middleware factory: blocks any protected route for users whose
 * `mustChangePassword` flag is true.
 *
 * The flag is read from two sources (in order):
 * 1. **Test mock header** (`x-mock-must-change-password: true`) — only when
 *    `HOSPEDA_ALLOW_MOCK_ACTOR = true` in test mode. Lets tests inject
 *    a forced-change-password state without a real DB row.
 * 2. **Better Auth session user** (`c.get('user')?.mustChangePassword`) —
 *    populated by `authMiddleware` from the Better Auth session. Requires
 *    `mustChangePassword` to be declared as an `additionalField` in
 *    `lib/auth.ts` (see the comment there).
 *
 * @returns Hono middleware handler
 */
export function mustChangePasswordGate(): AppMiddleware {
    return async (c, next) => {
        // Allow recovery paths through unconditionally
        const requestPath = c.req.path;
        const isExempt = EXEMPT_PATH_SUFFIXES.some((suffix) => requestPath.endsWith(suffix));
        if (isExempt) {
            await next();
            return;
        }

        // ── Test-mode mock override ──────────────────────────────────────────
        // When ALLOW_MOCK_ACTOR is active (unit / integration tests), respect
        // the special header so tests can exercise the blocked + unblocked paths
        // without requiring a real DB user row with the flag set.
        const isMockMode =
            env.NODE_ENV === 'test' && env.HOSPEDA_ALLOW_MOCK_ACTOR === true && env.CI !== 'true';

        if (isMockMode) {
            const mockFlag = c.req.header('x-mock-must-change-password');
            if (mockFlag === 'true') {
                apiLogger.debug(
                    { path: requestPath },
                    '[must-change-password] Gate triggered via mock header'
                );
                return c.json(BLOCKED_RESPONSE, 403);
            }
            // explicit 'false' or absent → fall through to normal flow
        }

        // ── Real session user ────────────────────────────────────────────────
        // Better Auth sets `c.get('user')` in authMiddleware. The session user
        // object carries `mustChangePassword` when it is declared as an
        // `additionalField` in `lib/auth.ts`. If the user is not authenticated
        // (guest) there is no `user` object and the flag is vacuously false —
        // the protected auth gate upstream will already have rejected guests.
        const sessionUser = c.get('user') as
            | (Record<string, unknown> & { mustChangePassword?: boolean | null })
            | undefined
            | null;

        const mustChange = sessionUser?.mustChangePassword === true;

        if (mustChange) {
            const actorId = sessionUser && 'id' in sessionUser ? String(sessionUser.id) : 'unknown';

            apiLogger.warn(
                { actorId, path: requestPath },
                '[must-change-password] Blocking request: mustChangePassword flag is set'
            );
            return c.json(BLOCKED_RESPONSE, 403);
        }

        await next();
    };
}
