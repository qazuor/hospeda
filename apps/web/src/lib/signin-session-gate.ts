/**
 * @file signin-session-gate.ts
 * @description Decides what `/auth/signin` does with a visitor that ALREADY
 * has a session (BETA-216).
 *
 * The page used to redirect them silently to their destination. That is wrong
 * when the visitor came to sign in as a DIFFERENT account (for example after
 * resetting another account's password in the same browser): they landed in
 * the old account believing they were in the new one. The default is now an
 * interstitial that names the account and lets them continue or switch.
 *
 * The silent redirect survives only for ONE flow, which is machine-driven and
 * has no human to ask: a SIGNED OAuth authorization request (`client_id` +
 * `sig` + `ba_param`, HOS-2184), where the API's OAuth provider sent the
 * browser here and expects it to resume on the consent page.
 *
 * The post-verification landing `?verified=1` is deliberately NOT exempt: Better
 * Auth's verify-email also redirects to that fallback WITHOUT creating a session
 * (the account was already verified, or the token is expired/invalid and
 * `&error=CODE` is appended), so account B's link would otherwise land silently
 * in account A's session.
 */

import { isSignedOAuthRequest } from '@/lib/oauth-consent';

/** What `signin.astro` does with an authenticated visitor. */
export type AuthenticatedSigninAction = 'redirect' | 'interstitial';

/**
 * Chooses between the silent redirect and the "already signed in" interstitial.
 *
 * @param params.search - The request query string (with or without the `?`)
 * @returns `'redirect'` for the machine-driven flows above, otherwise `'interstitial'`
 */
export function resolveAuthenticatedSigninAction({
    search
}: {
    readonly search: string;
}): AuthenticatedSigninAction {
    if (isSignedOAuthRequest({ search })) return 'redirect';
    return 'interstitial';
}
