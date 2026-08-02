/**
 * @file commerce-ports.ts
 * @description Port implementations for the CommerceOwnerProvisioningService (SPEC-239 T-050).
 *
 * Bridges the service-layer ports to the API's runtime dependencies
 * (Better Auth for user creation, sendNotification for credential delivery).
 *
 * ## Why this file exists
 *
 * `CommerceOwnerProvisioningService` in `@repo/service-core` is intentionally
 * decoupled from Better Auth and from the notification transport: it accepts
 * two injected ports rather than importing `apps/api` internals directly.
 * This file is the single place in `apps/api` that wires those ports, keeping
 * the boundary explicit and testable.
 *
 * @module lib/commerce-ports
 */

import { getDb, users } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import type { CreateUserPort, ProvisioningNotificationPort } from '@repo/service-core';
import { grantRole } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
import { getAuth } from './auth';

// ---------------------------------------------------------------------------
// CreateUserPort
// ---------------------------------------------------------------------------

/**
 * Creates a {@link CreateUserPort} implementation backed by Better Auth.
 *
 * The factory takes the incoming request headers so Better Auth receives the
 * same origin / cookie context as the enclosing request (required by some
 * Better Auth plugins).
 *
 * ## Resolve-or-create, not create (HOS-296 G-4 / AC-4)
 *
 * This port used to call `auth.api.signUpEmail` with **no prior lookup** and
 * then overwrite `users.role`. Both halves were bugs:
 *
 * - When the email already belonged to an account, Better Auth's duplicate
 *   check rejected the signup, `CommerceOwnerProvisioningService` turned that
 *   into an `INTERNAL_ERROR`, and `approveAndProvision` threw **before**
 *   marking the lead approved. The lead was then stuck forever: the admin
 *   cannot edit a lead's email (`CommerceLeadAdminUpdateInputSchema` does not
 *   expose it) and no endpoint links a lead to an existing user. The only exit
 *   was rejecting the lead.
 * - The role overwrite destroyed whatever hat the account already wore.
 *
 * A registered host adding their restaurant is the ordinary case, not the edge
 * case — and it has to work on the SAME email, because the MercadoPago payout
 * account is keyed by it.
 *
 * ## Steps performed
 * 1. Look the email up in `users`.
 * 2. **Found** → grant the target role additively and return
 *    `alreadyExisted: true`. The account keeps its own password, its
 *    `mustChangePassword` flag and its other hats; nothing is overwritten.
 * 3. **Not found** → sign up via `auth.api.signUpEmail`, set `emailVerified`
 *    and `mustChangePassword`, then grant the role. If either step fails, the
 *    freshly created user is deleted (orphan prevention) and the error is
 *    rethrown so the provisioning service surfaces it.
 *
 * @param headers - Raw request headers forwarded to Better Auth.
 * @returns A {@link CreateUserPort} implementation.
 *
 * @example
 * ```ts
 * const createUser = createCommerceOwnerCreateUserPort(c.req.raw.headers);
 * const provisioningService = new CommerceOwnerProvisioningService(
 *   { logger: apiLogger },
 *   createUser,
 * );
 * ```
 */
export function createCommerceOwnerCreateUserPort(headers: Headers): CreateUserPort {
    return async ({ email, password, name, role, mustChangePassword }) => {
        const db = getDb();

        // 1. Resolve the email first. Soft-deleted accounts are deliberately
        //    INCLUDED: the unique constraint on `users.email` still covers
        //    them, so treating one as "not found" would just push the same
        //    duplicate-email failure one step further down.
        const existing = await db
            .select({ id: users.id, email: users.email, displayName: users.displayName })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        const existingUser = existing[0];
        if (existingUser) {
            // 2. Additive grant — the account keeps every hat it already wears.
            const granted = await grantRole({
                userId: existingUser.id,
                role,
                grantedBy: null,
                reason: RoleGrantReason.COMMERCE_LEAD_APPROVED
            });
            if (granted.error) {
                throw new Error(
                    `Failed to grant role ${role} to existing user ${existingUser.id}: ${granted.error.message}`
                );
            }

            apiLogger.info(
                { userId: existingUser.id, grantedRole: role },
                'commerce-ports: email already registered — granted the commerce hat to the existing account'
            );

            return {
                id: existingUser.id,
                email: existingUser.email,
                name: existingUser.displayName ?? name,
                alreadyExisted: true
            };
        }

        // 3. Create user via Better Auth (which grants the baseline USER hat
        //    from its own `user.create.after` database hook).
        const auth = getAuth();
        const signUpResult = await auth.api.signUpEmail({
            body: { email, password, name },
            headers,
            asResponse: false
        });

        if (!signUpResult?.user?.id) {
            apiLogger.error(
                { signUpResult },
                'commerce-ports: Better Auth signUpEmail did not return a user id'
            );
            throw new Error('Could not create the user account via Better Auth');
        }

        const newUserId = signUpResult.user.id;

        try {
            // `emailVerified = true` prevents the Better Auth email-verification
            // gate from blocking a staff-provisioned account on first login.
            await db
                .update(users)
                .set({ emailVerified: true, mustChangePassword })
                .where(eq(users.id, newUserId));

            const granted = await grantRole({
                userId: newUserId,
                role,
                grantedBy: null,
                reason: RoleGrantReason.COMMERCE_LEAD_APPROVED
            });
            if (granted.error) {
                throw granted.error;
            }
        } catch (setupError) {
            // Best-effort cleanup: delete the orphan user row so the DB does
            // not accumulate accounts that never received the commerce hat.
            apiLogger.error(
                {
                    err: setupError instanceof Error ? setupError.message : String(setupError),
                    userId: newUserId,
                    targetRole: role
                },
                'commerce-ports: role grant / mustChangePassword UPDATE failed — deleting orphan user'
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
                    'commerce-ports: orphan DELETE also failed — manual intervention required'
                );
            }

            throw new Error(
                `Failed to assign role ${role} to new user ${newUserId}: ${setupError instanceof Error ? setupError.message : String(setupError)}`
            );
        }

        return {
            id: newUserId,
            email: signUpResult.user.email,
            name: signUpResult.user.name ?? name,
            alreadyExisted: false
        };
    };
}

// ---------------------------------------------------------------------------
// ProvisioningNotificationPort
// ---------------------------------------------------------------------------

/**
 * Creates a {@link ProvisioningNotificationPort} implementation that sends
 * the commerce owner's temporary credentials via the notification system.
 *
 * The credential email contains:
 * - The owner's name (personalisation)
 * - The server-generated temporary password (required for first login)
 * - A direct link to the change-password page (`/mi-cuenta/cambiar-contrasena`)
 *
 * **Security note**: the temporary password appears in the email body because
 * the owner needs it to log in for the first time.  The notification service
 * does NOT store it in plain text beyond the email transport.
 *
 * The returned implementation `await`s the `sendNotification` call so that
 * the provisioning service's best-effort try/catch can capture any transport
 * failures and log them without aborting provisioning.
 *
 * @param siteUrl - Base URL of the public web app (e.g. `https://hospeda.com.ar`).
 *   Used to construct the change-password link.
 * @returns A {@link ProvisioningNotificationPort} implementation.
 *
 * @example
 * ```ts
 * const notifier = createCommerceOwnerCredentialsNotificationPort('https://hospeda.com.ar');
 * const provisioningService = new CommerceOwnerProvisioningService(
 *   { logger: apiLogger },
 *   createUser,
 *   notifier,
 * );
 * ```
 */
export function createCommerceOwnerCredentialsNotificationPort(
    siteUrl: string
): ProvisioningNotificationPort {
    return {
        notifyOwnerCredentials: async ({ email, name, temporaryPassword, leadId }) => {
            await sendNotification({
                type: NotificationType.COMMERCE_OWNER_CREDENTIALS,
                recipientEmail: email,
                recipientName: name,
                userId: null,
                temporaryPassword,
                leadId,
                changePasswordUrl: `${siteUrl}/mi-cuenta/cambiar-contrasena`
            });
        }
    };
}

// ---------------------------------------------------------------------------
// Re-export role constant for callers
// ---------------------------------------------------------------------------
export { RoleEnum };
