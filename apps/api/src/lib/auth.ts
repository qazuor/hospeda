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
import { parseTrustedOriginsFromConfig } from './auth-trusted-origins';

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
                        // The reset-password page is a SPA that consumes the token via
                        // ?token= and calls the BA reset endpoint from the React island.
                        // BA itself does not perform a redirect for reset, so we link
                        // straight to the web page.
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
                            // Dev/test convenience: when no mailer is configured
                            // there is no realistic way for the user to verify
                            // their email via UI. Auto-flip emailVerified=true
                            // so the rest of the flow (sign-in, profile guard,
                            // protected routes) stays exercisable locally.
                            // Production environments MUST set the env var and
                            // never reach this branch.
                            if (env.NODE_ENV !== 'production') {
                                const db = getDb();
                                await db
                                    .update(users)
                                    .set({ emailVerified: true })
                                    .where(eq(users.id, user.id));
                                logger.warn(
                                    { userId: user.id, env: env.NODE_ENV },
                                    'HOSPEDA_EMAIL_API_KEY not set - auto-verified user in non-prod env'
                                );
                                return;
                            }
                            logger.warn(
                                { userId: user.id },
                                'HOSPEDA_EMAIL_API_KEY not set - skipping verification email'
                            );
                            return;
                        }
                        const client = createEmailClient({ apiKey });
                        // Use Better Auth's native verify-email handler with a
                        // callbackURL pointing back to the web sign-in page.
                        // Better Auth verifies the token server-side and 302s the user
                        // to the callback URL — no SPA round-trip needed (avoids CORS
                        // and the lack of POST support on /api/auth/verify-email).
                        const apiOrigin = env.HOSPEDA_API_URL.replace(/\/$/, '');
                        const siteOrigin = env.HOSPEDA_SITE_URL.replace(/\/$/, '');
                        const callbackURL = `${siteOrigin}/es/auth/signin?verified=1`;
                        const verificationUrl = `${apiOrigin}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}`;
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

        /**
         * Account linking: if a user already exists with a given email and
         * the same email comes back through a different OAuth provider, link
         * the new provider to the existing user instead of rejecting with
         * `account_not_linked`. Both Google and Facebook verify the email
         * on their side before returning it, so trusting them here is safe.
         * Without this, the second provider attempt dead-ends with an error
         * and the user has to manually figure out which provider they used
         * the first time.
         */
        account: {
            accountLinking: {
                enabled: true,
                trustedProviders: ['google', 'facebook']
            }
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

                        // Anonymous newsletter linking (non-blocking).
                        // Attaches every anonymous `newsletter_subscribers` row whose
                        // `email` matches the new user's email — and, when the
                        // account email is verified at signup time (typical for
                        // OAuth providers), promotes any pending row to active
                        // with a transactional welcome email. Mirrors the
                        // anonymous-conversations link above; same constraint
                        // applies: registration MUST NOT fail because of this.
                        //
                        // The newsletter service singleton may throw on access
                        // when HOSPEDA_NEWSLETTER_HMAC_SECRET is unset (e.g. local
                        // dev without a mailer config). We swallow that path so
                        // the registration finishes cleanly — the eventually-set
                        // secret will let the user trigger the link via a
                        // subsequent subscribe / resend.
                        try {
                            const { getDefaultNewsletterService } = await import(
                                '../routes/newsletter/protected/_singletons'
                            );
                            const newsletterSvc = getDefaultNewsletterService();
                            const result = await newsletterSvc.linkAnonymousSubscribersToUser({
                                userId: user.id,
                                email: user.email,
                                accountEmailVerified: user.emailVerified === true
                            });
                            if (result.error) {
                                logger.warn(
                                    {
                                        userId: user.id,
                                        code: result.error.code,
                                        reason: (result.error as { reason?: string }).reason
                                    },
                                    'linkAnonymousSubscribersToUser returned an error result'
                                );
                            } else if (
                                result.data &&
                                (result.data.linkedCount > 0 ||
                                    result.data.promotedToActiveCount > 0)
                            ) {
                                logger.info(
                                    {
                                        userId: user.id,
                                        linkedCount: result.data.linkedCount,
                                        promotedToActiveCount: result.data.promotedToActiveCount
                                    },
                                    'Linked anonymous newsletter subscribers to new user'
                                );
                            }
                        } catch (err) {
                            logger.error(
                                {
                                    err,
                                    userId: user.id
                                },
                                'Failed to link anonymous newsletter subscribers on user registration'
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
 * Module-level adapter that wires the runtime `env` + `logger` to the
 * pure {@link parseTrustedOriginsFromConfig} parser. The actual auth
 * config call site uses this; tests target the pure function from
 * `./auth-trusted-origins` directly.
 *
 * @see SPEC-103 T-055
 */
function parseTrustedOrigins(): string[] {
    return parseTrustedOriginsFromConfig({
        siteUrl: env.HOSPEDA_SITE_URL,
        adminUrl: env.HOSPEDA_ADMIN_URL,
        extraOrigins: env.HOSPEDA_EXTRA_TRUSTED_ORIGINS,
        nodeEnv: env.NODE_ENV,
        onWarn: ({ value, reason }) => {
            logger.warn({ value, reason }, 'Ignoring HOSPEDA_EXTRA_TRUSTED_ORIGINS entry');
        }
    });
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
