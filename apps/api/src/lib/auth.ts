/**
 * Better Auth core configuration.
 *
 * Provides self-hosted authentication with cookie-based sessions,
 * email/password auth with bcrypt hashing, social OAuth providers,
 * admin plugin for roles and ban management, and email integration.
 *
 * Uses lazy initialization to ensure the database is ready before
 * creating the auth instance.
 *
 * @module auth
 */

import { and, asc, conversations, eq, getDb, isNull } from '@repo/db';
import { accounts, sessions, users, verifications } from '@repo/db';
import { createEmailClient, sendEmail } from '@repo/email';
import { ResetPasswordTemplate } from '@repo/email';
import { VerifyEmailTemplate } from '@repo/email';
import { createLogger } from '@repo/logger';
import { RoleEnum } from '@repo/schemas';
import { compare, hash } from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, createAccessControl } from 'better-auth/plugins';
import { getQZPayBilling } from '../middlewares/billing';
import { BillingCustomerSyncService } from '../services/billing-customer-sync';
import { env } from '../utils/env';

const logger = createLogger('auth');

/**
 * Better Auth access control configuration.
 * Defines what each role can do within Better Auth's admin plugin.
 * These are Better Auth-level permissions (user CRUD, session management),
 * separate from Hospeda's application-level PermissionEnum.
 */
const statements = {
    user: [
        'create',
        'list',
        'set-role',
        'ban',
        'impersonate',
        'delete',
        'set-password',
        'get',
        'update'
    ],
    session: ['list', 'revoke', 'delete']
} as const;

const ac = createAccessControl(statements);

/** Full admin access for SUPER_ADMIN and ADMIN roles */
const fullAdminRole = ac.newRole({
    user: [
        'create',
        'list',
        'set-role',
        'ban',
        'impersonate',
        'delete',
        'set-password',
        'get',
        'update'
    ],
    session: ['list', 'revoke', 'delete']
});

/** No admin access for regular roles */
const noAdminRole = ac.newRole({
    user: [],
    session: []
});

/** Bcrypt salt rounds for password hashing */
const BCRYPT_SALT_ROUNDS = 12;

/** Session expiry: 7 days in seconds */
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7;

/** Session refresh threshold: 1 day in seconds */
const SESSION_UPDATE_AGE = 60 * 60 * 24;

/** Cookie cache duration: 5 minutes in seconds */
const COOKIE_CACHE_MAX_AGE = 5 * 60;

/**
 * Maximum number of concurrent active sessions per user.
 *
 * When a new session is created and the user already has this many active
 * sessions, the oldest session (by `createdAt`) is deleted automatically
 * (FIFO eviction). This prevents unbounded session accumulation from
 * forgotten log-ins on multiple devices.
 *
 * Value chosen to accommodate legitimate multi-device usage (phone, tablet,
 * desktop, work computer) while bounding the attack surface.
 */
const MAX_SESSIONS_PER_USER = 10;

/** Default user settings for new signups */
const DEFAULT_USER_SETTINGS = {
    notifications: {
        enabled: true,
        allowEmails: true,
        allowSms: false,
        allowPush: false
    }
} as const;

/** Lazy-initialized Better Auth instance */
let authInstance: ReturnType<typeof betterAuth> | null = null;

/**
 * Returns the Better Auth instance, creating it on first call.
 *
 * Uses lazy initialization because the database must be initialized
 * via `initializeDb()` before the auth instance can be created.
 * The auth instance is cached as a singleton for subsequent calls.
 *
 * @returns Better Auth instance configured for the Hospeda platform
 * @throws Error if HOSPEDA_BETTER_AUTH_SECRET is not set
 *
 * @example
 * ```typescript
 * import { getAuth } from '../lib/auth';
 *
 * // Mount auth handler on Hono app
 * app.on(['POST', 'GET'], '/api/auth/*', (c) => {
 *   return getAuth().handler(c.req.raw);
 * });
 * ```
 */
export function getAuth(): ReturnType<typeof betterAuth> {
    if (authInstance) {
        return authInstance;
    }

    const secret = env.HOSPEDA_BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error(
            'HOSPEDA_BETTER_AUTH_SECRET environment variable is required. ' +
                'Generate one with: openssl rand -base64 32'
        );
    }

    const baseURL = env.HOSPEDA_API_URL;

    authInstance = betterAuth({
        secret,
        baseURL,
        basePath: '/api/auth',

        database: drizzleAdapter(getDb(), {
            provider: 'pg',
            schema: {
                user: users,
                session: sessions,
                account: accounts,
                verification: verifications
            }
        }),

        user: {
            fields: {
                name: 'displayName'
            },
            additionalFields: {
                slug: {
                    type: 'string',
                    required: false
                },
                role: {
                    type: 'string',
                    required: false
                },
                settings: {
                    type: 'string',
                    required: false
                },
                visibility: {
                    type: 'string',
                    required: false
                },
                lifecycleState: {
                    type: 'string',
                    required: false
                }
            }
        },

        session: {
            cookieCache: {
                enabled: true,
                maxAge: COOKIE_CACHE_MAX_AGE
            },
            expiresIn: SESSION_EXPIRES_IN,
            updateAge: SESSION_UPDATE_AGE
        },

        emailAndPassword: {
            enabled: true,
            // Require users to verify their email address before they can sign in.
            // Better Auth blocks sign-in attempts for unverified accounts and
            // returns an EMAIL_NOT_VERIFIED error so the frontend can guide them
            // back to the verification flow.
            requireEmailVerification: true,
            password: {
                hash: async (password: string) => hash(password, BCRYPT_SALT_ROUNDS),
                verify: async ({
                    hash: storedHash,
                    password
                }: { hash: string; password: string }) => compare(password, storedHash)
            },
            sendResetPassword: async ({ user, token }) => {
                // Fire-and-forget to prevent timing attacks (BA recommendation)
                void (async () => {
                    try {
                        const apiKey = env.HOSPEDA_EMAIL_API_KEY;
                        if (!apiKey) {
                            logger.warn(
                                { userId: user.id },
                                'HOSPEDA_EMAIL_API_KEY not set - skipping password reset email'
                            );
                            return;
                        }
                        const client = createEmailClient({ apiKey });
                        // Build a web-app URL so the user lands on the SPA reset-password
                        // page (which calls the BA reset endpoint via the auth-client),
                        // instead of hitting the API directly.
                        const siteOrigin = env.HOSPEDA_SITE_URL.replace(/\/$/, '');
                        const resetUrl = `${siteOrigin}/es/auth/reset-password?token=${encodeURIComponent(token)}`;
                        const result = await sendEmail({
                            client,
                            to: user.email,
                            subject: 'Restablece tu contraseña de Hospeda',
                            react: ResetPasswordTemplate({
                                name: user.name || user.email,
                                resetUrl
                            })
                        });
                        if (result.success) {
                            logger.info(
                                { userId: user.id },
                                'Password reset email dispatched to provider'
                            );
                        } else {
                            logger.warn(
                                { userId: user.id, error: result.error },
                                'Failed to send password reset email'
                            );
                        }
                    } catch (error) {
                        logger.warn(
                            {
                                userId: user.id,
                                error: error instanceof Error ? error.message : String(error)
                            },
                            'Failed to send password reset email'
                        );
                    }
                })();
            }
        },

        emailVerification: {
            sendVerificationEmail: async ({ user, token }) => {
                // Fire-and-forget to prevent timing attacks (BA recommendation)
                void (async () => {
                    try {
                        const apiKey = env.HOSPEDA_EMAIL_API_KEY;
                        if (!apiKey) {
                            logger.warn(
                                { userId: user.id },
                                'HOSPEDA_EMAIL_API_KEY not set - skipping verification email'
                            );
                            return;
                        }
                        const client = createEmailClient({ apiKey });
                        // Build a web-app URL so the user lands on the SPA verify-email
                        // page (which calls the BA verify endpoint via the auth-client
                        // and shows a polished success/error UI), instead of hitting
                        // the API directly and seeing the JSON response.
                        const siteOrigin = env.HOSPEDA_SITE_URL.replace(/\/$/, '');
                        const verificationUrl = `${siteOrigin}/es/auth/verify-email?token=${encodeURIComponent(token)}`;
                        const result = await sendEmail({
                            client,
                            to: user.email,
                            subject: 'Verifica tu cuenta de Hospeda',
                            react: VerifyEmailTemplate({
                                name: user.name || user.email,
                                verificationUrl
                            })
                        });
                        if (result.success) {
                            logger.info(
                                { userId: user.id },
                                'Verification email dispatched to provider'
                            );
                        } else {
                            logger.warn(
                                { userId: user.id, error: result.error },
                                'Failed to send verification email'
                            );
                        }
                    } catch (error) {
                        logger.warn(
                            {
                                userId: user.id,
                                error: error instanceof Error ? error.message : String(error)
                            },
                            'Failed to send verification email'
                        );
                    }
                })();
            },
            sendOnSignUp: true,
            autoSignInAfterVerification: true
        },

        /**
         * OAuth social providers.
         *
         * Each provider is conditionally enabled based on env vars.
         * Callback URLs (auto-generated by Better Auth):
         *   - Google:   {HOSPEDA_API_URL}/api/auth/callback/google
         *   - Facebook: {HOSPEDA_API_URL}/api/auth/callback/facebook
         *
         * Required env vars per provider:
         *   - Google:   HOSPEDA_GOOGLE_CLIENT_ID, HOSPEDA_GOOGLE_CLIENT_SECRET
         *   - Facebook: HOSPEDA_FACEBOOK_CLIENT_ID, HOSPEDA_FACEBOOK_CLIENT_SECRET
         *
         * Console setup:
         *   - Google Cloud Console: APIs & Services > Credentials > OAuth 2.0 Client IDs
         *   - Facebook Developer Console: App Settings > Facebook Login > Settings
         */
        socialProviders: {
            ...(env.HOSPEDA_GOOGLE_CLIENT_ID &&
                (() => {
                    if (!env.HOSPEDA_GOOGLE_CLIENT_SECRET) {
                        throw new Error(
                            'HOSPEDA_GOOGLE_CLIENT_SECRET is required when HOSPEDA_GOOGLE_CLIENT_ID is set'
                        );
                    }
                    return {
                        google: {
                            clientId: env.HOSPEDA_GOOGLE_CLIENT_ID,
                            clientSecret: env.HOSPEDA_GOOGLE_CLIENT_SECRET
                        }
                    };
                })()),
            ...(env.HOSPEDA_FACEBOOK_CLIENT_ID &&
                (() => {
                    if (!env.HOSPEDA_FACEBOOK_CLIENT_SECRET) {
                        throw new Error(
                            'HOSPEDA_FACEBOOK_CLIENT_SECRET is required when HOSPEDA_FACEBOOK_CLIENT_ID is set'
                        );
                    }
                    return {
                        facebook: {
                            clientId: env.HOSPEDA_FACEBOOK_CLIENT_ID,
                            clientSecret: env.HOSPEDA_FACEBOOK_CLIENT_SECRET
                        }
                    };
                })())
        },

        plugins: [
            admin({
                defaultRole: RoleEnum.HOST,
                adminRoles: [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN],
                roles: {
                    SUPER_ADMIN: fullAdminRole,
                    ADMIN: fullAdminRole,
                    CLIENT_MANAGER: noAdminRole,
                    EDITOR: noAdminRole,
                    HOST: noAdminRole,
                    SPONSOR: noAdminRole,
                    USER: noAdminRole,
                    GUEST: noAdminRole
                }
            })
        ],

        advanced: {
            database: {
                generateId: () => crypto.randomUUID()
            },
            /** Explicitly enable CSRF protection (origin header + Fetch Metadata checks) */
            disableCSRFCheck: false,
            /** Explicitly enable origin validation for redirects */
            disableOriginCheck: false,
            useSecureCookies: env.NODE_ENV === 'production',
            /**
             * SSO across subdomains (web, admin, api). In production the cookie is
             * scoped to the apex `hospeda.com.ar` so a session minted on
             * `hospeda.com.ar` is also valid on `admin.hospeda.com.ar` and
             * `api.hospeda.com.ar`. In dev `domain` stays undefined so cookies
             * fall back to per-host scoping (localhost:3000 vs localhost:4321).
             */
            crossSubDomainCookies: {
                enabled: true,
                domain: env.NODE_ENV === 'production' ? 'hospeda.com.ar' : undefined
            }
        },

        databaseHooks: {
            session: {
                create: {
                    /**
                     * Enforces the per-user concurrent session limit (FIFO eviction).
                     *
                     * Before a new session row is written to the database, counts how
                     * many active sessions the user already has. If the count is at or
                     * above `MAX_SESSIONS_PER_USER`, the oldest session (by `createdAt`
                     * ascending) is deleted so the new one can take its place.
                     *
                     * This hook never blocks session creation. It only evicts the
                     * oldest session when the limit is exceeded, providing a seamless
                     * experience across multiple devices while bounding session growth.
                     *
                     * @param session - The session about to be created
                     */
                    before: async (session) => {
                        const db = getDb();
                        const userId = session.userId;

                        // Fetch all existing sessions for this user, oldest first
                        const existingSessions = await db
                            .select({ id: sessions.id, createdAt: sessions.createdAt })
                            .from(sessions)
                            .where(eq(sessions.userId, userId))
                            .orderBy(asc(sessions.createdAt));

                        if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
                            // Delete the oldest session to make room (FIFO)
                            const oldest = existingSessions[0];
                            if (oldest) {
                                await db.delete(sessions).where(eq(sessions.id, oldest.id));

                                logger.info(
                                    {
                                        userId,
                                        evictedSessionId: oldest.id,
                                        sessionCount: existingSessions.length,
                                        limit: MAX_SESSIONS_PER_USER
                                    },
                                    'Oldest session evicted to enforce per-user session limit'
                                );
                            }
                        }

                        // Allow session creation to proceed
                        return true;
                    }
                }
            },
            user: {
                create: {
                    before: async (user) => {
                        // Generate a unique slug from the user's display name or email
                        const baseName = (user.name || user.email?.split('@')[0] || 'user')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '');
                        const slug = `${baseName}-${crypto.randomUUID().slice(0, 8)}`;

                        return {
                            data: {
                                ...user,
                                slug,
                                // Sign up as USER. Promotion to HOST happens
                                // atomically when the user publishes their first
                                // accommodation through the host-onboarding flow
                                // (AccommodationService.publish). Creating users
                                // as HOST here would short-circuit the
                                // permission check on createForOnboarding and
                                // also break the first-publish trial
                                // detection because billing_subscriptions stays
                                // empty until publish.
                                role: RoleEnum.USER,
                                settings: DEFAULT_USER_SETTINGS,
                                visibility: 'PUBLIC',
                                lifecycleState: 'ACTIVE'
                            }
                        };
                    },
                    after: async (user) => {
                        logger.info(
                            { userId: user.id, email: user.email },
                            'New user created via Better Auth'
                        );

                        // Billing customer sync (non-blocking).
                        // We create the billing_customers row eagerly here so
                        // the first-publish flow has a customer record ready
                        // when it queries eligibility. We DO NOT auto-start a
                        // trial here anymore: the trial is created atomically
                        // by AccommodationService.publish() on the user's first
                        // publish, alongside the lifecycleState flip and the
                        // USER -> HOST role promotion.
                        try {
                            const billing = getQZPayBilling();
                            const syncService = new BillingCustomerSyncService(billing);
                            await syncService.ensureCustomerExists({
                                userId: user.id,
                                email: user.email,
                                name: user.name || undefined
                            });
                        } catch (error) {
                            logger.error(
                                {
                                    userId: user.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                'Failed to sync billing customer on user creation'
                            );
                        }

                        // Anonymous conversation linking (non-blocking)
                        // Links all verified anonymous conversations where anonymousEmail matches
                        // the newly registered user's email, setting userId on each unlinked row.
                        try {
                            const db = getDb();
                            const pendingConversations = await db
                                .select({ id: conversations.id })
                                .from(conversations)
                                .where(
                                    and(
                                        eq(conversations.anonymousEmail, user.email),
                                        eq(conversations.anonymousEmailVerified, true),
                                        isNull(conversations.userId),
                                        isNull(conversations.deletedAt)
                                    )
                                );

                            for (const conv of pendingConversations) {
                                // Race guard: only update when userId is still null
                                await db
                                    .update(conversations)
                                    .set({ userId: user.id })
                                    .where(
                                        and(
                                            eq(conversations.id, conv.id),
                                            isNull(conversations.userId)
                                        )
                                    );
                            }

                            if (pendingConversations.length > 0) {
                                logger.info(
                                    {
                                        userId: user.id,
                                        linkedCount: pendingConversations.length
                                    },
                                    'Linked anonymous conversations to new user'
                                );
                            }
                        } catch (err) {
                            // Registration MUST NOT fail because of this. Log and continue.
                            logger.error(
                                {
                                    err,
                                    userId: user.id
                                },
                                'Failed to link anonymous conversations on user registration'
                            );
                        }
                    }
                },
                update: {
                    after: async (user) => {
                        // Sync billing customer data when user is updated
                        try {
                            const billing = getQZPayBilling();
                            const syncService = new BillingCustomerSyncService(billing);
                            await syncService.syncCustomerData({
                                userId: user.id,
                                email: user.email,
                                name: user.name || undefined
                            });
                        } catch (error) {
                            logger.error(
                                {
                                    userId: user.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                'Failed to sync billing customer on user update'
                            );
                        }
                    }
                }
            }
        },

        trustedOrigins: parseTrustedOrigins()
    });

    return authInstance;
}

/**
 * Parse trusted origins from environment variables.
 * Falls back to default development origins if none are configured.
 *
 * @returns Array of trusted origin URLs
 */
function parseTrustedOrigins(): string[] {
    const origins: string[] = [];

    const siteUrl = env.HOSPEDA_SITE_URL;
    if (siteUrl) {
        origins.push(siteUrl);
    }

    const adminUrl = env.HOSPEDA_ADMIN_URL;
    if (adminUrl) {
        origins.push(adminUrl);
    }

    // Default development origins
    if (origins.length === 0) {
        if (env.NODE_ENV === 'production') {
            throw new Error(
                'HOSPEDA_SITE_URL and HOSPEDA_ADMIN_URL must be configured in production. ' +
                    'Cannot fall back to localhost origins in production environment.'
            );
        }
        origins.push('http://localhost:3000', 'http://localhost:4321');
    }

    return origins;
}

/**
 * Reset the auth instance.
 * Useful for testing to ensure a fresh auth instance per test.
 */
export function resetAuth(): void {
    authInstance = null;
}

/** Type for the Better Auth instance */
export type Auth = ReturnType<typeof getAuth>;
