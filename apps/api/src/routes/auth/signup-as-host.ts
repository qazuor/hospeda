/**
 * @file signup-as-host.ts
 * @description Sign-up endpoint that is functionally equivalent to Better
 * Auth's own `/api/auth/sign-up/email` but writes `role=HOST` on the new user
 * instead of the default `role=USER`.
 *
 * Why this exists:
 *   - Better Auth has one server instance shared by `apps/web` and
 *     `apps/admin`, and only one `defaultRole` (`USER`). That default is
 *     correct for tourists signing up from the public web — they are
 *     promoted to HOST later through the host-onboarding funnel.
 *   - Hosts who self-identify by signing up from the admin form need to
 *     start out as HOST so the admin panel guard lets them in directly.
 *   - Discriminating by `Origin` inside Better Auth (`hooks.before`,
 *     `databaseHooks.user.create.before`) was tried and did not work in this
 *     setup (the input validator rejects `role` on the body, and the user
 *     database hooks did not fire under the admin plugin). A custom endpoint
 *     is the predictable alternative documented in the architecture notes.
 *
 * Defense:
 *   - The endpoint hard-fails when the request's `Origin` header does not
 *     match `HOSPEDA_ADMIN_URL`. Public web callers cannot escalate to HOST
 *     via this route even if they happen to find the URL.
 *   - If the post-signup UPDATE fails, we DELETE the freshly created user
 *     so the system does not end up with orphan accounts.
 */

import { getDb, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth } from '../../lib/auth';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createPublicRoute } from '../../utils/route-factory';

const SignupAsHostBodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(255)
});

const SignupAsHostResponseSchema = z.object({
    token: z.string().nullable(),
    user: z.object({
        id: z.string(),
        email: z.string(),
        role: z.literal(RoleEnum.HOST)
    })
});

const ORIGIN_MISMATCH_ERROR =
    'signup-as-host is only available from the admin panel; use /api/auth/sign-up/email for public signups';

/**
 * Normalize an origin string by stripping any trailing slash so the
 * equality check does not fail due to `http://x/` vs `http://x`.
 */
const stripSlash = (value: string): string => value.replace(/\/$/, '');

export const signupAsHostRoute = createPublicRoute({
    method: 'post',
    path: '/signup-as-host',
    summary: 'Sign up a new user as HOST (admin panel only)',
    description:
        'Creates a user via Better Auth and immediately sets their role to HOST. Only callable from the admin panel (Origin header must match HOSPEDA_ADMIN_URL).',
    tags: ['Auth'],
    requestBody: SignupAsHostBodySchema,
    responseSchema: SignupAsHostResponseSchema,
    handler: async (c, _params, body) => {
        const expectedOrigin = stripSlash(env.HOSPEDA_ADMIN_URL ?? '');
        const requestOrigin = stripSlash(c.req.header('origin') ?? '');

        if (expectedOrigin === '' || requestOrigin !== expectedOrigin) {
            apiLogger.warn(
                {
                    requestOrigin: requestOrigin || '(missing)',
                    expectedOrigin: expectedOrigin || '(unconfigured)'
                },
                'signup-as-host: rejected due to Origin mismatch'
            );
            // Use 403 (Forbidden) over 401 because no authentication is
            // expected — the request is simply not allowed from this surface.
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: ORIGIN_MISMATCH_ERROR }
                },
                403
            );
        }

        // body is already validated by the route factory using
        // SignupAsHostBodySchema; cast it to the inferred type so callees see
        // the narrowed shape.
        const input = body as z.infer<typeof SignupAsHostBodySchema>;

        // Delegate to Better Auth's server-side API so we get the same
        // password hashing, email verification email, account row creation
        // and session token issuance as the public /sign-up/email route.
        const auth = getAuth();
        const signUpResult = await auth.api.signUpEmail({
            body: input,
            headers: c.req.raw.headers,
            asResponse: false
        });

        if (!signUpResult?.user?.id) {
            apiLogger.error(
                { signUpResult },
                'signup-as-host: Better Auth signUpEmail did not return a user id'
            );
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'SIGNUP_FAILED',
                        message: 'Could not create the user account'
                    }
                },
                500
            );
        }

        const newUserId = signUpResult.user.id;
        const db = getDb();

        try {
            await db.update(users).set({ role: RoleEnum.HOST }).where(eq(users.id, newUserId));
        } catch (error) {
            // Best-effort cleanup so we don't leave an orphan user stuck on
            // role=USER (the Better Auth default) — that would be worse than
            // a clean failure because the host would later need a SUPER_ADMIN
            // to fix it by hand.
            apiLogger.error(
                {
                    err: error instanceof Error ? error.message : String(error),
                    userId: newUserId
                },
                'signup-as-host: role UPDATE failed, deleting the freshly created user'
            );
            try {
                await db.delete(users).where(eq(users.id, newUserId));
            } catch (cleanupError) {
                apiLogger.error(
                    {
                        err:
                            cleanupError instanceof Error
                                ? cleanupError.message
                                : String(cleanupError),
                        userId: newUserId
                    },
                    'signup-as-host: cleanup DELETE also failed; manual intervention required'
                );
            }
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'ROLE_ASSIGNMENT_FAILED',
                        message: 'Could not assign host role to the new user'
                    }
                },
                500
            );
        }

        apiLogger.info(
            { userId: newUserId, email: input.email },
            'signup-as-host: new HOST account created'
        );

        return {
            token: signUpResult.token ?? null,
            user: {
                id: signUpResult.user.id,
                email: signUpResult.user.email,
                role: RoleEnum.HOST
            }
        };
    }
});
