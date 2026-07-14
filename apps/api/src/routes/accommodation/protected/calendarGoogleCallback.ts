/**
 * GET /api/v1/protected/accommodations/calendar-sync/google/callback
 *
 * OAuth callback that completes the Google Calendar connect flow (HOS-157
 * Phase 2 — Layer 4). This is a FIXED path with NO `:id` segment: the
 * accommodation being connected travels in the one-time `state` token (bound
 * server-side to the accommodation + initiating user), matching the redirect
 * URI registered in `HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI` and on the Google
 * OAuth client.
 *
 * ## Why this is a PUBLIC (skipAuth) route + a CSRF cookie
 *
 * The callback runs `createPublicRoute` deliberately: a returning browser
 * navigation whose Better Auth session lapsed during the multi-step Google
 * consent flow must still land on the friendly `?calendarSync=error` redirect —
 * not a raw JSON 401 from the auth middleware. But dropping session auth alone
 * would open a login-CSRF: an attacker could start a connect flow for THEIR own
 * accommodation and hand a victim the resulting Google consent URL, attaching
 * the victim's calendar to the attacker's accommodation. To close that, the
 * connect route sets an HttpOnly, SameSite=Lax cookie holding the `state`, and
 * this callback requires the returned `state` to MATCH that cookie
 * (double-submit) — proving the completing browser is the SAME one that started
 * the flow, without needing a fresh session. The state itself stays one-time,
 * unguessable, 5-minute, and server-bound.
 *
 * On success the tokens are exchanged and persisted (encrypted) via
 * `saveGoogleConnection`; on any failure NO partial credential is stored. The
 * handler always ends in a 302 back to the web app with a result flag — the
 * declared `responseSchema` is documentation-only (the factory passes a raw
 * `Response` through untouched).
 *
 * @module routes/accommodation/protected/calendarGoogleCallback
 */

import type { Context } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
    CALENDAR_OAUTH_STATE_COOKIE,
    validateAndConsumeCalendarOAuthState
} from '../../../services/google-calendar/calendar-oauth-state';
import { saveGoogleConnection } from '../../../services/google-calendar/google-calendar-credential.repository';
import { exchangeAuthorizationCode } from '../../../services/google-calendar/google-oauth-client';
import { env } from '../../../utils/env';
import { createPublicRoute } from '../../../utils/route-factory';

/** Default calendar to sync on first connect. */
const DEFAULT_CALENDAR_ID = 'primary';

/** Documentation-only schema — the handler always returns a raw 302 redirect. */
const CallbackDocsSchema = z.object({
    redirectUrl: z.string()
});

/**
 * Builds the web-app redirect URL the host lands on after the OAuth dance,
 * returning them to `returnTo` (the editor page they started from) when it is a
 * safe same-origin path, else the site root.
 *
 * The open-redirect guard is AUTHORITATIVE: it resolves the candidate with
 * `new URL()` and keeps it only when the resulting origin equals the site
 * origin. This defeats every WHATWG-parser quirk that string denylisting misses
 * (leading `/\`, embedded tab/LF/CR, etc.) — those all resolve to a different
 * origin and are dropped. The web editor (Layer 5) reads the `calendarSync` +
 * `accommodationId` query flags to show a success/error toast.
 */
export const buildWebRedirect = (params: {
    result: 'connected' | 'error';
    accommodationId?: string;
    returnTo?: string;
}): string => {
    const base = env.HOSPEDA_SITE_URL ?? '';
    const origin = base.length > 0 ? base : 'https://hospeda.com.ar';

    let target: URL;
    try {
        const candidate = new URL(params.returnTo ?? '/', origin);
        target = candidate.origin === new URL(origin).origin ? candidate : new URL('/', origin);
    } catch {
        target = new URL('/', origin);
    }

    target.searchParams.set('calendarSync', params.result);
    if (params.accommodationId !== undefined) {
        target.searchParams.set('accommodationId', params.accommodationId);
    }
    return target.toString();
};

/**
 * GET /api/v1/protected/accommodations/calendar-sync/google/callback
 *
 * Completes the Google Calendar OAuth flow and 302-redirects back to the web
 * editor with a `calendarSync=connected|error` flag. Public (skipAuth) — the
 * one-time CSRF state + the double-submit cookie are the credentials.
 */
export const protectedCalendarGoogleCallbackRoute = createPublicRoute({
    method: 'get',
    path: '/calendar-sync/google/callback',
    summary: 'Complete the Google Calendar connect flow',
    description:
        'Validates the double-submit state cookie, consumes the one-time OAuth state, ' +
        'exchanges the authorization code for tokens, persists the encrypted connection ' +
        'for the accommodation bound to the state, then redirects back to the web editor. ' +
        'Fixed redirect URI — accommodation id comes from the state. Public route: the CSRF ' +
        'state (matched against a connect-time cookie) is the credential, not the session.',
    tags: ['Accommodations'],
    requestQuery: {
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        error: z.string().optional()
    },
    responseSchema: CallbackDocsSchema,
    handler: async (ctx: Context, _params, _body, query?: Record<string, unknown>) => {
        const state = query?.state as string | undefined;
        const code = query?.code as string | undefined;
        const oauthError = query?.error as string | undefined;

        // Read then ALWAYS clear the one-time double-submit cookie.
        const cookieState = getCookie(ctx, CALENDAR_OAUTH_STATE_COOKIE);
        deleteCookie(ctx, CALENDAR_OAUTH_STATE_COOKIE, { path: '/' });

        // Double-submit CSRF: the state must appear in BOTH the query and the
        // connect-time cookie, and match. A mismatch/absence means a different
        // browser is completing the flow (login-CSRF) — treat as no valid state.
        const stateMatches =
            state !== undefined && cookieState !== undefined && cookieState === state;
        const consumed = stateMatches ? validateAndConsumeCalendarOAuthState(state) : null;

        // The user denied consent, or Google returned an error, or the code is
        // missing → bounce back with an error flag (returning them to the
        // originating editor page when the state told us where that was).
        if (oauthError || !code) {
            return ctx.redirect(
                buildWebRedirect({
                    result: 'error',
                    ...(consumed?.accommodationId === undefined
                        ? {}
                        : { accommodationId: consumed.accommodationId }),
                    ...(consumed?.returnTo === undefined ? {} : { returnTo: consumed.returnTo })
                }),
                302
            );
        }

        // A code is present but the state was absent/cookie-mismatched/invalid/
        // expired/replayed — reject rather than exchange (CSRF protection).
        if (consumed === null) {
            throw new HTTPException(400, { message: 'Invalid or expired OAuth state' });
        }

        if (
            !env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID ||
            !env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET ||
            !env.HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI
        ) {
            throw new HTTPException(503, { message: 'Google Calendar sync is not configured' });
        }

        try {
            const tokens = await exchangeAuthorizationCode({
                code,
                redirectUri: env.HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI
            });

            await saveGoogleConnection({
                accommodationId: consumed.accommodationId,
                externalCalendarId: DEFAULT_CALENDAR_ID,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken ?? null,
                tokenScope: tokens.scope ?? null,
                tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
                createdById: consumed.userId
            });
        } catch {
            // Never leak token-exchange internals to the browser; bounce with a
            // generic error flag. No partial credential was persisted.
            return ctx.redirect(
                buildWebRedirect({
                    result: 'error',
                    accommodationId: consumed.accommodationId,
                    ...(consumed.returnTo === undefined ? {} : { returnTo: consumed.returnTo })
                }),
                302
            );
        }

        return ctx.redirect(
            buildWebRedirect({
                result: 'connected',
                accommodationId: consumed.accommodationId,
                ...(consumed.returnTo === undefined ? {} : { returnTo: consumed.returnTo })
            }),
            302
        );
    }
});
