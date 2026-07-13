/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/connect-google
 *
 * Owner self-service: start the Google Calendar connect (OAuth) flow for an
 * accommodation (HOS-157 Phase 2 — Layer 4, spec section 6).
 *
 * Gate model (mirrors the manual occupancy write routes): ownership +
 * `ACCOMMODATION_OCCUPANCY_MANAGE` are enforced inline via
 * `assertOccupancyManageAccess`; the `CAN_SYNC_EXTERNAL_CALENDAR` billing
 * entitlement is enforced HERE at the route via `requireEntitlement` (reading
 * the same `userEntitlements` context the frontend gate trusts), never
 * re-checked in a service resolver.
 *
 * The handler does NOT redirect the browser itself — it returns the Google
 * authorization URL so the web app (which made an authenticated fetch) can
 * navigate the user there. The one-time CSRF `state` binds the accommodation +
 * user server-side (see `calendar-oauth-state.ts`); `access_type=offline` +
 * `prompt=consent` guarantee Google issues a refresh token.
 *
 * @module routes/accommodation/protected/calendarConnectGoogle
 */

import { EntitlementKey } from '@repo/billing';
import { AccommodationIdSchema } from '@repo/schemas';
import { assertOccupancyManageAccess } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { generateCalendarOAuthState } from '../../../services/google-calendar/calendar-oauth-state';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Google's OAuth 2.0 authorization endpoint. */
const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Read-only Calendar scope — the ONLY scope this integration ever requests. */
const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const ConnectGoogleResponseSchema = z.object({
    authorizeUrl: z.string().url()
});

/**
 * Optional same-origin relative path to return the browser to after the OAuth
 * callback completes (e.g. the editor page). Constrained to a safe relative
 * path — must start with a single `/` and must NOT be protocol-relative (`//`)
 * or contain a scheme — so it can never be abused as an open redirect.
 */
const SafeReturnToSchema = z
    .string()
    .max(512)
    .refine((value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('://'), {
        message: 'returnTo must be a same-origin relative path'
    });

const ConnectGoogleBodySchema = z.object({
    returnTo: SafeReturnToSchema.optional()
});

/**
 * POST /api/v1/protected/accommodations/:id/calendar-sync/connect-google
 *
 * Returns the Google OAuth authorization URL the web app should send the host
 * to. Requires ownership + `ACCOMMODATION_OCCUPANCY_MANAGE` and a live
 * `CAN_SYNC_EXTERNAL_CALENDAR` entitlement.
 */
export const protectedCalendarConnectGoogleRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/calendar-sync/connect-google',
    summary: 'Start the Google Calendar connect flow (owner)',
    description:
        'Returns the Google OAuth authorization URL for connecting an accommodation to a ' +
        'Google Calendar for occupancy sync. Requires ACCOMMODATION_OCCUPANCY_MANAGE, ' +
        'ownership, and a live CAN_SYNC_EXTERNAL_CALENDAR entitlement.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: ConnectGoogleBodySchema,
    responseSchema: ConnectGoogleResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;
        const returnTo = (body as { returnTo?: string }).returnTo;

        // Ownership + MANAGE (throws ServiceError NOT_FOUND / FORBIDDEN).
        await assertOccupancyManageAccess({ actor, accommodationId });

        if (!env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID || !env.HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI) {
            throw new HTTPException(503, {
                message: 'Google Calendar sync is not configured'
            });
        }

        const state = generateCalendarOAuthState({
            accommodationId,
            userId: actor.id,
            ...(returnTo === undefined ? {} : { returnTo })
        });

        const authorizeUrl = new URL(GOOGLE_AUTHORIZATION_URL);
        authorizeUrl.searchParams.set('client_id', env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID);
        authorizeUrl.searchParams.set('redirect_uri', env.HOSPEDA_GOOGLE_CALENDAR_REDIRECT_URI);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', CALENDAR_READONLY_SCOPE);
        // access_type=offline + prompt=consent are REQUIRED for Google to return
        // a refresh_token (without it there is no way to refresh the access token
        // and the connection dies at the first expiry).
        authorizeUrl.searchParams.set('access_type', 'offline');
        authorizeUrl.searchParams.set('prompt', 'consent');
        authorizeUrl.searchParams.set('state', state);

        return { authorizeUrl: authorizeUrl.toString() };
    },
    options: {
        middlewares: [requireEntitlement(EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR)]
    }
});
