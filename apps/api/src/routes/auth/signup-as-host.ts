/**
 * @file signup-as-host.ts
 * @description Authenticated, permission-gated staff action that creates a new
 * user with `role=HOST` instead of the Better Auth default `role=USER`.
 *
 * Why this exists:
 *   - Better Auth has one server instance shared by `apps/web` and
 *     `apps/admin`, and only one `defaultRole` (`USER`). That default is
 *     correct for tourists signing up from the public web — they are
 *     promoted to HOST later through the host-onboarding funnel.
 *   - Back-office staff need a way to provision a host account directly so the
 *     new host can sign in to the admin panel without going through the
 *     publish-a-first-listing promotion path.
 *   - Discriminating by `Origin` inside Better Auth (`hooks.before`,
 *     `databaseHooks.user.create.before`) was tried and did not work in this
 *     setup (the input validator rejects `role` on the body, and the user
 *     database hooks did not fire under the admin plugin). A custom endpoint
 *     is the predictable alternative documented in the architecture notes.
 *
 * Access control (SPEC-182 T-011):
 *   - This is an ADMIN-tier route (`/api/v1/admin/auth/signup-as-host`) gated by
 *     `PermissionEnum.USER_CREATE`. The route factory's admin middleware
 *     enforces a valid session (401 when absent) and the permission (403 when
 *     the actor lacks USER_CREATE) BEFORE the handler runs — there is no manual
 *     Origin or session check here. The previous Origin-header guard (which
 *     allowed an unauthenticated public form) is removed: BETA-57 is resolved by
 *     deleting that surface, and host provisioning is now a staff-only action.
 *   - If the post-signup UPDATE fails, we DELETE the freshly created user so the
 *     system does not end up with orphan accounts.
 */

import { getDb, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth } from '../../lib/auth';
import { getActorFromContext } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

const SignupAsHostBodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).max(255)
});

// The created host's session token is intentionally NOT returned: this is a
// staff action creating an account for someone else, so leaking the new user's
// session token to the operator serves no purpose and is mildly unsafe.
const SignupAsHostResponseSchema = z.object({
    user: z.object({
        id: z.string(),
        email: z.string(),
        role: z.literal(RoleEnum.HOST)
    })
});

export const signupAsHostRoute = createAdminRoute({
    method: 'post',
    path: '/signup-as-host',
    summary: 'Create a new HOST account (staff action)',
    description:
        'Creates a user via Better Auth and immediately sets their role to HOST. Authenticated staff action gated by the USER_CREATE permission.',
    tags: ['Auth'],
    requiredPermissions: [PermissionEnum.USER_CREATE],
    requestBody: SignupAsHostBodySchema,
    responseSchema: SignupAsHostResponseSchema,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);

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
            { userId: newUserId, email: input.email, actorId: actor.id },
            'signup-as-host: new HOST account created'
        );

        // Audit log: a staff member provisioned a new HOST account (PII-sensitive
        // operation), consistent with the admin user-create endpoint.
        auditLog({
            auditEvent: AuditEventType.USER_ADMIN_MUTATION,
            actorId: actor.id,
            targetUserId: newUserId,
            operation: 'create'
        });

        return {
            user: {
                id: signUpResult.user.id,
                email: signUpResult.user.email,
                role: RoleEnum.HOST
            }
        };
    }
});
