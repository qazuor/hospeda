import { createClerkClient } from '@clerk/backend';
import { getAuth } from '@hono/clerk-auth';
import { z } from '@hono/zod-openapi';
import { AuthProviderEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { UserService } from '@repo/service-core';
import { createGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

export const authSyncRoute = createSimpleRoute({
    method: 'post',
    path: '/sync',
    summary: 'Sync authenticated user with DB',
    description:
        'Ensures the authenticated IdP user exists in DB, creates/updates as needed, and returns the DB user.',
    tags: ['Auth'],
    options: { skipAuth: true },
    responseSchema: z
        .object({
            user: z.object({ id: z.string() }).passthrough()
        })
        .openapi('AuthSyncResponse'),
    handler: async (c) => {
        try {
            const auth = getAuth(c);
            if (!auth?.userId) {
                // During OAuth callback, Clerk cookies might not be fully synced yet
                // Return a more specific error to help with debugging
                return {
                    success: false,
                    error: {
                        code: 'AUTH_NOT_READY',
                        message: 'Authentication not ready. Please try again in a moment.'
                    }
                };
            }

            const provider = AuthProviderEnum.CLERK as string;
            const providerUserId = auth.userId;

            // Since we're skipping auth middleware, use the existing user as actor for this operation
            // First, get the existing user to use as actor
            const guestActor = createGuestActor();
            const existingUser = await userService.getByAuthProviderId(guestActor, {
                provider,
                providerUserId
            });

            // Use the existing user as actor, or find a Super Admin for foreign key constraints
            let actor: Actor;
            if (existingUser.data?.user) {
                actor = {
                    id: existingUser.data.user.id,
                    role: existingUser.data.user.role,
                    permissions: existingUser.data.user.permissions
                };
            } else {
                // For new users, use guest actor
                // The service layer will handle foreign key constraints appropriately
                actor = guestActor;
            }

            // Fetch Clerk user details (server-side) to enrich profile & identities
            const secretKey =
                env.HOSPEDA_CLERK_SECRET_KEY || process.env.HOSPEDA_CLERK_SECRET_KEY || '';
            if (!secretKey) {
                apiLogger.error('HOSPEDA_CLERK_SECRET_KEY is required for user sync');
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'CONFIGURATION_ERROR',
                            message: 'Authentication service is not properly configured'
                        }
                    },
                    500
                );
            }
            const client = createClerkClient({ secretKey });
            const clerkUser = await client.users.getUser(providerUserId);
            const profile = {
                firstName: clerkUser.firstName ?? undefined,
                lastName: clerkUser.lastName ?? undefined,
                displayName: clerkUser.fullName ?? undefined,
                contactInfo: undefined,
                profile: clerkUser.imageUrl ? { avatar: { url: clerkUser.imageUrl } } : undefined
            } as const;
            type ExternalAccount = {
                id: string;
                provider?: string;
                emailAddress?: string;
                username?: string;
                avatarUrl?: string;
                [key: string]: unknown;
            };
            const identities = (
                (clerkUser.externalAccounts as unknown as ExternalAccount[]) || []
            ).map((acc: ExternalAccount) => ({
                provider: acc.provider || 'unknown',
                providerUserId: acc.id,
                email: acc.emailAddress,
                username: acc.username,
                avatarUrl: acc.avatarUrl,
                raw: acc,
                lastLoginAt: undefined
            }));

            const result = await userService.ensureFromAuthProvider(actor, {
                provider,
                providerUserId,
                profile,
                identities
            });
            if (result.error) {
                return {
                    success: false,
                    error: { code: result.error.code, message: result.error.message }
                };
            }

            // Invalidate user cache since user data may have been updated
            userCache.invalidate(providerUserId);
            // Update Clerk publicMetadata with dbUserId
            try {
                await client.users.updateUser(providerUserId, {
                    publicMetadata: {
                        ...(clerkUser.publicMetadata || {}),
                        dbUserId: result.data.user.id
                    }
                });
            } catch {}

            return { user: result.data.user };
        } catch (error) {
            apiLogger.error({ message: 'Error in /auth/sync', error });
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'SYNC_ERROR',
                        message: 'Failed to sync user with database'
                    }
                },
                500
            );
        }
    }
});
