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
 * Security:
 * 1. The `state` is validated + consumed (one-time, unguessable, server-bound).
 * 2. The returning session actor must equal the `userId` the state was issued
 *    for — a second layer over the state's own CSRF protection.
 * 3. On success the tokens are exchanged and persisted (encrypted) via
 *    `saveGoogleConnection`; on any failure NO partial credential is stored.
 *
 * The handler always ends in a 302 back to the web app with a result flag —
 * this is a browser-navigation endpoint, not a JSON API. The declared
 * `responseSchema` is documentation-only (the factory passes a raw `Response`
 * through untouched).
 *
 * @module routes/accommodation/protected/calendarGoogleCallback
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { validateAndConsumeCalendarOAuthState } from '../../../services/google-calendar/calendar-oauth-state';
import { saveGoogleConnection } from '../../../services/google-calendar/google-calendar-credential.repository';
import { exchangeAuthorizationCode } from '../../../services/google-calendar/google-oauth-client';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Default calendar to sync on first connect. */
const DEFAULT_CALENDAR_ID = 'primary';

/** Documentation-only schema — the handler always returns a raw 302 redirect. */
const CallbackDocsSchema = z.object({
    redirectUrl: z.string()
});

/**
 * Whether a `returnTo` is a safe same-origin relative path (defense-in-depth —
 * it was already validated at the connect route, re-checked here so a bad value
 * can never produce an off-site redirect).
 */
const isSafeReturnTo = (returnTo: string): boolean =>
    returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://');

/**
 * Builds the web-app redirect URL the host lands on after the OAuth dance.
 * Returns them to `returnTo` (the editor page they started from) when present
 * and safe, else the site root. The web editor (Layer 5) reads the
 * `calendarSync` + `accommodationId` query flags to show a success/error toast
 * on the calendar section.
 */
const buildWebRedirect = (params: {
    result: 'connected' | 'error';
    accommodationId?: string;
    returnTo?: string;
}): string => {
    const base = env.HOSPEDA_SITE_URL ?? '';
    const origin = base.length > 0 ? base : 'https://hospeda.com.ar';
    const path =
        params.returnTo !== undefined && isSafeReturnTo(params.returnTo) ? params.returnTo : '/';
    const url = new URL(path, origin);
    url.searchParams.set('calendarSync', params.result);
    if (params.accommodationId !== undefined) {
        url.searchParams.set('accommodationId', params.accommodationId);
    }
    return url.toString();
};

/**
 * GET /api/v1/protected/accommodations/calendar-sync/google/callback
 *
 * Completes the Google Calendar OAuth flow and 302-redirects back to the web
 * editor with a `calendarSync=connected|error` flag.
 */
export const protectedCalendarGoogleCallbackRoute = createProtectedRoute({
    method: 'get',
    path: '/calendar-sync/google/callback',
    summary: 'Complete the Google Calendar connect flow (owner)',
    description:
        'Validates the OAuth state, exchanges the authorization code for tokens, persists ' +
        'the encrypted connection for the accommodation bound to the state, then redirects ' +
        'back to the web editor. Fixed redirect URI — accommodation id comes from the state.',
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

        // The user denied consent (or Google returned an error) — bounce back
        // with an error flag rather than treating it as a hard failure.
        if (oauthError || !state || !code) {
            return ctx.redirect(buildWebRedirect({ result: 'error' }), 302);
        }

        const consumed = validateAndConsumeCalendarOAuthState(state);
        if (consumed === null) {
            throw new HTTPException(400, { message: 'Invalid or expired OAuth state' });
        }

        // Defense-in-depth: the returning session must be the same user that
        // started the flow.
        const actor = getActorFromContext(ctx);
        if (actor.id !== consumed.userId) {
            throw new HTTPException(403, {
                message: 'OAuth state does not belong to the current user'
            });
        }

        if (!env.HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI) {
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
