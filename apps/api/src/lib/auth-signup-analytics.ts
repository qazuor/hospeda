/**
 * @file auth-signup-analytics.ts
 * @description Helpers for the `signup_completed` PostHog event, fired from the
 * Better Auth `databaseHooks.user.create.after` hook (see `auth.ts`).
 *
 * Capturing signup server-side (rather than in the web SignUp form) is what
 * makes OAuth signups observable: the OAuth flow is a full redirect that
 * unmounts the form, so the client can never emit the event for Google/Facebook
 * signups. The `user.create` hook fires exactly once per new user — on creation
 * only, never on subsequent logins — so it is the single canonical source for
 * both email and OAuth signups.
 */

import { createLogger } from '@repo/logger';
import { getPostHogClient } from './posthog';

const logger = createLogger('auth-signup-analytics');

/**
 * Minimal structural shape of the Better Auth endpoint context needed to derive
 * the signup provider. Kept intentionally loose so it accepts the real
 * `GenericEndpointContext` without coupling to its full type surface.
 */
export interface SignupContextLike {
    readonly path?: string;
    readonly params?: Record<string, unknown>;
}

/**
 * Derive the signup provider from the Better Auth endpoint path that triggered
 * user creation.
 *
 * - `'/sign-up/email'` → `'email'`
 * - `'/callback/:id'` → the concrete OAuth provider (e.g. `'google'`,
 *   `'facebook'`) read from the `:id` route param
 * - anything else (or a missing context) → `'unknown'`
 *
 * @param context - The Better Auth endpoint context passed to the hook, or null.
 * @returns The provider slug used as the `provider` event property.
 */
export function deriveSignupProvider(context: SignupContextLike | null | undefined): string {
    if (context?.path === '/sign-up/email') {
        return 'email';
    }
    if (context?.path === '/callback/:id' && typeof context.params?.id === 'string') {
        return context.params.id;
    }
    return 'unknown';
}

/**
 * Fire the `signup_completed` PostHog event for a newly created user.
 *
 * Non-blocking by contract: any failure (PostHog client unavailable, capture
 * throwing) is swallowed and logged so it can NEVER fail user registration.
 *
 * @param input - The new user's id (used as the PostHog distinct id) and the
 *   Better Auth endpoint context used to derive the provider.
 */
export function captureSignupCompleted(input: {
    userId: string;
    context: SignupContextLike | null | undefined;
}): void {
    try {
        getPostHogClient()?.capture({
            distinctId: input.userId,
            event: 'signup_completed',
            properties: { provider: deriveSignupProvider(input.context) }
        });
    } catch (error) {
        logger.warn(
            {
                userId: input.userId,
                error: error instanceof Error ? error.message : String(error)
            },
            'PostHog capture failed for signup_completed (non-blocking)'
        );
    }
}
