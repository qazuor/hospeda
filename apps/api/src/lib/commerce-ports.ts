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
import { RoleEnum } from '@repo/schemas';
import type { CreateUserPort, ProvisioningNotificationPort } from '@repo/service-core';
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
 * ## Steps performed
 * 1. Sign up via `auth.api.signUpEmail` (creates the user row with the
 *    Better Auth default role of `USER`).
 * 2. Update the user row to set the target role, `emailVerified = true`, and
 *    `mustChangePassword = true` so the SPEC-239 password-gate fires on first
 *    login.
 * 3. If the UPDATE fails, delete the freshly created user (orphan prevention)
 *    and throw so the provisioning service can surface a clean error.
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
        const auth = getAuth();

        // 1. Create user via Better Auth (role defaults to USER at this point)
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
        const db = getDb();

        try {
            // 2. Set role, emailVerified and mustChangePassword in one UPDATE.
            //    `emailVerified = true` prevents the Better Auth email-verification
            //    gate from blocking a staff-provisioned account on first login.
            await db
                .update(users)
                .set({ role, emailVerified: true, mustChangePassword })
                .where(eq(users.id, newUserId));
        } catch (updateError) {
            // 3. Best-effort cleanup: delete the orphan user row so the DB
            //    does not accumulate users stuck on role=USER.
            apiLogger.error(
                {
                    err: updateError instanceof Error ? updateError.message : String(updateError),
                    userId: newUserId,
                    targetRole: role
                },
                'commerce-ports: role/mustChangePassword UPDATE failed — deleting orphan user'
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
                `Failed to assign role ${role} to new user ${newUserId}: ${updateError instanceof Error ? updateError.message : String(updateError)}`
            );
        }

        return {
            id: newUserId,
            email: signUpResult.user.email,
            name: signUpResult.user.name ?? name
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
