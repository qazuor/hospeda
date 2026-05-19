/**
 * @file reset-password-status.ts
 * @description SSR helper that decides whether the reset-password page should
 * render the form, the "expired" error, or the "invalid" error.
 *
 * Wraps the public-tier `GET /api/v1/public/auth/reset-password/check` call so
 * the page (`pages/[lang]/auth/reset-password.astro`) stays declarative and
 * the decision logic can be unit-tested without rendering Astro.
 *
 * See SPEC-118 for the 2-reason contract rationale.
 */

import type { ResetPasswordCheckResult, authApi } from '@/lib/api/endpoints';
import type { ApiResult } from '@/lib/api/types';

/**
 * Resolved status the reset-password page branches on.
 *
 * - `valid`: render the existing `ResetPassword` form island.
 * - `invalid` with reason: render `ResetPasswordTokenError` and skip the form.
 */
export type ResetPasswordTokenStatus =
    | { readonly kind: 'valid' }
    | { readonly kind: 'invalid'; readonly reason: 'expired' | 'invalid' };

/**
 * Callback the page passes in to actually hit the API. We accept a function
 * rather than the `authApi` reference so tests can inject a fake without
 * mocking the whole `@/lib/api/endpoints` module.
 */
export type ResetPasswordChecker = (params: {
    readonly token: string;
}) => Promise<ApiResult<ResetPasswordCheckResult>>;

/**
 * Optional logger surface used to record check failures. Mirrors the shape of
 * `webLogger.warn` so callers can pass the logger directly; tests can pass a
 * spy or omit it entirely.
 */
export type ResetPasswordStatusLogger = {
    readonly warn: (...args: ReadonlyArray<unknown>) => void;
};

/**
 * Decide what the reset-password page should render.
 *
 * Branches:
 * - missing/empty token → `invalid` (no network call).
 * - check returns `valid: true` → `valid`.
 * - check returns `valid: false` → carry the reason.
 * - check returns transport error (`ok: false`) → degrade to `valid` so the
 *   form's submit-error handler can still surface a dead token; logs a warn.
 */
export const resolveResetPasswordTokenStatus = async ({
    token,
    check,
    logger
}: {
    readonly token: string;
    readonly check: ResetPasswordChecker;
    readonly logger?: ResetPasswordStatusLogger;
}): Promise<ResetPasswordTokenStatus> => {
    if (!token) {
        return { kind: 'invalid', reason: 'invalid' };
    }

    const result = await check({ token });

    if (!result.ok) {
        logger?.warn('reset-password: token check failed, falling back to form', {
            status: result.error.status,
            message: result.error.message
        });
        return { kind: 'valid' };
    }

    if (result.data.valid) {
        return { kind: 'valid' };
    }

    return { kind: 'invalid', reason: result.data.reason };
};

/**
 * Convenience wrapper that wires the live `authApi.checkResetPasswordToken`
 * into {@link resolveResetPasswordTokenStatus}. Pages use this; tests target
 * the pure function above.
 */
export const resolveResetPasswordTokenStatusFromApi = ({
    token,
    api,
    logger
}: {
    readonly token: string;
    readonly api: Pick<typeof authApi, 'checkResetPasswordToken'>;
    readonly logger?: ResetPasswordStatusLogger;
}): Promise<ResetPasswordTokenStatus> =>
    resolveResetPasswordTokenStatus({
        token,
        check: api.checkResetPasswordToken,
        logger
    });
