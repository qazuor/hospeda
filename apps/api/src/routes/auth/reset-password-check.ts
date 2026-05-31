/**
 * @file reset-password-check.ts
 * @description Reset-password token check endpoint (SPEC-118).
 *
 * GET /api/v1/public/auth/reset-password/check?token=<t>
 *
 * Returns whether a Better Auth password-reset token is currently valid,
 * expired, or invalid (the latter collapses "already used", "tampered" and
 * "never existed" because Better Auth deletes the verifications row on
 * consume and we cannot distinguish those cases post-hoc).
 *
 * The endpoint is public (no auth) and intended to be called server-side by
 * the web app's reset-password page on first render so we can show an error
 * state with a "Solicitá un enlace nuevo" CTA instead of an empty form when
 * the link is dead.
 *
 * See `.qtm/specs/SPEC-118-reset-password-token-validation/spec.md` for
 * the Phase 0 decision behind the 2-reason contract.
 */
import { getDb, verifications } from '@repo/db';
import {
    ResetPasswordCheckQuerySchema,
    type ResetPasswordCheckResponse,
    ResetPasswordCheckResponseSchema
} from '@repo/schemas';
import { and, eq, like } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger';
import { createPublicRoute } from '../../utils/route-factory';

/**
 * Better Auth identifier prefix for reset-password tokens.
 *
 * Better Auth v1.4.x stores reset-password verifications with an identifier
 * that begins with `reset-password` (see internal `password.ts` in the
 * Better Auth source). Because Hospeda does not configure a custom
 * `verification.storeIdentifier`, the value remains plain (not hashed) and
 * we can match by a `LIKE 'reset-password%'` filter on the identifier.
 *
 * If a future Better Auth upgrade changes the prefix, the unit test for this
 * route will fail loud and a one-line constant update fixes the regression.
 */
const RESET_PASSWORD_IDENTIFIER_PREFIX = 'reset-password';

export const resetPasswordCheckRoute = createPublicRoute({
    method: 'get',
    path: '/reset-password/check',
    summary: 'Check reset-password token validity (no consume)',
    description:
        'Returns whether a Better Auth password-reset token is still usable. Does not consume the token. Used by the web reset-password page to render an error state instead of an empty form when the link is dead.',
    tags: ['Auth'],
    requestQuery: ResetPasswordCheckQuerySchema.shape,
    responseSchema: ResetPasswordCheckResponseSchema,
    handler: async (_ctx, _params, _body, query) => {
        const { token } = query as { token: string };

        const result = await checkResetPasswordToken({ token, db: getDb() });

        return result;
    }
});

/**
 * Pure function that performs the verifications-table lookup and returns the
 * 2-reason payload. Extracted from the route handler so unit tests can drive
 * it directly without booting the Hono runtime.
 *
 * The Drizzle client is injected by the caller (the route handler passes
 * `getDb()`, tests pass a chainable mock). Keeping it explicit avoids the
 * destructuring-default footgun where `db = getDb()` would still evaluate
 * `getDb()` during transient module-init edge cases in Vitest.
 *
 * @param params.token Raw reset-password token from the email URL
 * @param params.db Drizzle client returned by `getDb()`
 * @returns A `ResetPasswordCheckResponse` describing the token's status.
 */
export const checkResetPasswordToken = async ({
    token,
    db
}: { token: string; db: ReturnType<typeof getDb> }): Promise<ResetPasswordCheckResponse> => {
    try {
        const rows = await db
            .select({
                expiresAt: verifications.expiresAt
            })
            .from(verifications)
            .where(
                and(
                    eq(verifications.value, token),
                    like(verifications.identifier, `${RESET_PASSWORD_IDENTIFIER_PREFIX}%`)
                )
            )
            .limit(1);

        const row = rows[0];

        if (!row) {
            return { valid: false, reason: 'invalid' };
        }

        const isExpired = row.expiresAt.getTime() <= Date.now();
        if (isExpired) {
            return { valid: false, reason: 'expired' };
        }

        return { valid: true };
    } catch (error) {
        apiLogger.error({
            message: 'reset-password/check: failed to query verifications table',
            error
        });
        // Fail closed: treat infrastructure errors as `invalid` so the web
        // page never falsely renders the form on a dead link. The user can
        // still click "Solicitá un enlace nuevo" to retry.
        return { valid: false, reason: 'invalid' };
    }
};
