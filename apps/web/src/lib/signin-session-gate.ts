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
 * The silent redirect survives only for two flows that are machine-driven and
 * have no human to ask:
 * - a SIGNED OAuth authorization request (`client_id` + `sig` + `ba_param`,
 *   HOS-2184): the API's OAuth provider sent the browser here and expects it to
 *   resume on the consent page;
 * - the post-verification landing `?verified=1` (the API's verification-link
 *   fallback): the link just created the session, so the visitor is by
 *   construction the account they verified.
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
    if (new URLSearchParams(search).get('verified') === '1') return 'redirect';
    return 'interstitial';
}
