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

import { getDb } from '@repo/db';
import { accounts, sessions, users, verifications } from '@repo/db';
import { sendEmail } from '@repo/email';
import { ResetPasswordTemplate } from '@repo/email';
import { VerifyEmailTemplate } from '@repo/email';
import { createLogger } from '@repo/logger';
import { compare, hash } from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { getQZPayBilling } from '../middlewares/billing';
import { BillingCustomerSyncService } from '../services/billing-customer-sync';
import { TrialService } from '../services/trial.service';

const logger = createLogger('auth');

/** Bcrypt salt rounds for password hashing */
const BCRYPT_SALT_ROUNDS = 12;

/** Session expiry: 7 days in seconds */
const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7;

/** Session refresh threshold: 1 day in seconds */
const SESSION_UPDATE_AGE = 60 * 60 * 24;

/** Cookie cache duration: 5 minutes in seconds */
const COOKIE_CACHE_MAX_AGE = 5 * 60;

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

    const secret = process.env.HOSPEDA_BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error(
            'HOSPEDA_BETTER_AUTH_SECRET environment variable is required. ' +
                'Generate one with: openssl rand -base64 32'
        );
    }

    const baseURL = process.env.HOSPEDA_API_URL || 'http://localhost:3001';

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
            password: {
                hash: async (password: string) => hash(password, BCRYPT_SALT_ROUNDS),
                verify: async ({
                    hash: storedHash,
                    password
                }: { hash: string; password: string }) => compare(password, storedHash)
            },
            sendResetPassword: async ({ user, url }) => {
                // Fire-and-forget to prevent timing attacks (BA recommendation)
                void sendEmail({
                    to: user.email,
                    subject: 'Restablece tu contraseña de Hospeda',
                    react: ResetPasswordTemplate({
                        name: user.name || user.email,
                        resetUrl: url
                    })
                }).then((result) => {
                    if (!result.success) {
                        logger.warn(
                            { userId: user.id, error: result.error },
                            'Failed to send password reset email'
                        );
                    }
                });
            }
        },

        emailVerification: {
            sendVerificationEmail: async ({ user, url }) => {
                // Fire-and-forget to prevent timing attacks (BA recommendation)
                void sendEmail({
                    to: user.email,
                    subject: 'Verifica tu cuenta de Hospeda',
                    react: VerifyEmailTemplate({
                        name: user.name || user.email,
                        verificationUrl: url
                    })
                }).then((result) => {
                    if (!result.success) {
                        logger.warn(
                            { userId: user.id, error: result.error },
                            'Failed to send verification email'
                        );
                    }
                });
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
            ...(process.env.HOSPEDA_GOOGLE_CLIENT_ID && {
                google: {
                    clientId: process.env.HOSPEDA_GOOGLE_CLIENT_ID,
                    clientSecret: process.env.HOSPEDA_GOOGLE_CLIENT_SECRET || ''
                }
            }),
            ...(process.env.HOSPEDA_FACEBOOK_CLIENT_ID && {
                facebook: {
                    clientId: process.env.HOSPEDA_FACEBOOK_CLIENT_ID,
                    clientSecret: process.env.HOSPEDA_FACEBOOK_CLIENT_SECRET || ''
                }
            })
        },

        plugins: [
            admin({
                defaultRole: 'USER'
            })
        ],

        advanced: {
            database: {
                generateId: () => crypto.randomUUID()
            }
        },

        databaseHooks: {
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
                                role: 'USER',
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

                        // Billing customer sync (non-blocking)
                        try {
                            const billing = getQZPayBilling();
                            const syncService = new BillingCustomerSyncService(billing);
                            const customerId = await syncService.ensureCustomerExists({
                                userId: user.id,
                                email: user.email,
                                name: user.name || undefined
                            });

                            if (customerId && user.role === 'HOST') {
                                const trialService = new TrialService(billing);
                                await trialService.startTrial({
                                    customerId,
                                    userType: 'owner'
                                });
                                logger.info(
                                    { userId: user.id, customerId },
                                    'Trial started for new HOST user'
                                );
                            }
                        } catch (error) {
                            logger.error(
                                {
                                    userId: user.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                'Failed to sync billing customer on user creation'
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

    const siteUrl = process.env.HOSPEDA_SITE_URL;
    if (siteUrl) {
        origins.push(siteUrl);
    }

    const adminUrl = process.env.HOSPEDA_ADMIN_URL;
    if (adminUrl) {
        origins.push(adminUrl);
    }

    // Default development origins
    if (origins.length === 0) {
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
