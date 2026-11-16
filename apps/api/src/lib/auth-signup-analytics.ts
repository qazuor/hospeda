/**
 * @file auth-signup-analytics.ts
 * @description Helpers for the `signup_completed` Umami event, fired from the
 * Better Auth `databaseHooks.user.create.after` hook (see `auth.ts`).
 *
 * Capturing signup server-side (rather than in the web SignUp form) is what
 * makes OAuth signups observable: the OAuth flow is a full redirect that
 * unmounts the form, so the client can never emit the event for Google/Facebook
 * signups. The `user.create` hook fires exactly once per new user — on creation
 * only, never on subsequent logins — so it is the single canonical source for
 * both email and OAuth signups.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { createLogger } from '@repo/logger';
import { getVisitorContextFromHeaders, type VisitorContext } from '../utils/visitor-context';
import { captureServerAnalyticsEvent } from './analytics-client';

const logger = createLogger('auth-signup-analytics');

/**
 * Minimal structural shape of the Better Auth endpoint context needed to derive
 * the signup provider. Kept intentionally loose so it accepts the real
 * `GenericEndpointContext` without coupling to its full type surface.
 */
export interface SignupContextLike {
    readonly path?: string;
    readonly params?: Record<string, unknown>;
    /** Headers of the request that triggered the hook (used for visitor attribution). */
    readonly headers?: Headers | null;
    /** The originating request, when the hook runs inside a request (fallback for `headers`). */
    readonly request?: { readonly headers: Headers } | null;
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
 * Fire the `signup_completed` Umami event for a newly created user.
 *
 * Non-blocking by contract: any failure (Umami client unavailable, capture
 * throwing) is swallowed and logged so it can NEVER fail user registration.
 *
 * @param input - The new user's id (used as the Umami distinct id) and the
 *   Better Auth endpoint context used to derive the provider.
 */
export function captureSignupCompleted(input: {
    userId: string;
    context: SignupContextLike | null | undefined;
}): void {
    try {
        const visitor = getVisitorContextFromHeaders({
            headers: input.context?.headers ?? input.context?.request?.headers
        });
        captureServerAnalyticsEvent({
            distinctId: input.userId,
            name: AnalyticsEvents.signUpCompleted,
            properties: {
                auth_method: deriveSignupProvider(input.context),
                role: 'USER',
                user_type: 'tourist'
            },
            ...(visitor ? { visitor } : {})
        });
    } catch (error) {
        logger.warn(
            {
                userId: input.userId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Umami capture failed for signup_completed (non-blocking)'
        );
    }
}

/**
 * Resolves the visitor to attribute to a `sign_in_completed` event, from the
 * Better Auth `session.create.after` hook arguments.
 *
 * Returns `undefined` (so the event falls back to a synthetic identity) when the
 * session was not created by the visitor themselves: admin impersonation
 * (`session.impersonatedBy` set), any `/admin/*` endpoint, or a request whose
 * headers carry the not-visitor marker (e.g. staff-initiated `signup-as-host`,
 * whose first session would otherwise carry the staff member's IP / User-Agent).
 *
 * @param input - The created session and the endpoint context of the hook
 * @returns The visitor identity, or `undefined`
 */
export function resolveSignInVisitor(input: {
    readonly session: Readonly<Record<string, unknown>>;
    readonly context: SignupContextLike | null | undefined;
}): VisitorContext | undefined {
    const { session, context } = input;
    if (session['impersonatedBy']) return undefined;
    if (context?.path?.startsWith('/admin/')) return undefined;
    return getVisitorContextFromHeaders({ headers: context?.headers ?? context?.request?.headers });
}
