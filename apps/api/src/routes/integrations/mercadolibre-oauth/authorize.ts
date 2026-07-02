/**
 * @file authorize.ts
 *
 * Admin-only endpoint that starts the MercadoLibre OAuth authorization-code
 * flow (HOS-45 / SPEC-278 T-011). Generates a CSRF `state` token, stores it
 * short-lived in an in-memory map, and 302-redirects the operator's browser
 * to MercadoLibre's authorization page.
 *
 * The paired callback route that exchanges the returned `code` (and
 * validates/consumes the `state` via {@link validateAndConsumeState}) is a
 * separate, not-yet-built task (T-012).
 *
 * @module routes/integrations/mercadolibre-oauth/authorize
 */

import { randomBytes } from 'node:crypto';
import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { createAdminRoute } from '../../../utils/route-factory';

/** MercadoLibre's OAuth authorization endpoint (Argentina site). */
const MERCADOLIBRE_AUTHORIZATION_URL = 'https://auth.mercadolibre.com.ar/authorization';

/** How long a generated CSRF `state` token stays valid before it expires. */
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** A pending (not-yet-consumed) OAuth CSRF state entry. */
interface PendingStateEntry {
    /** Epoch ms timestamp the state was generated at. */
    readonly createdAt: number;
}

/**
 * Module-level singleton store for short-lived OAuth CSRF state tokens.
 *
 * There is no session/cookie store wired for this admin-only, server-to-server
 * redirect flow, so an in-memory map is sufficient: entries live at most
 * {@link STATE_TTL_MS} and are swept on every access. The callback route
 * (T-012, not yet built) will import {@link validateAndConsumeState} from this
 * module to validate the `state` MercadoLibre echoes back.
 */
const pendingStates = new Map<string, PendingStateEntry>();

/**
 * Removes expired entries from {@link pendingStates}. Called on every read
 * and write so the map never grows unbounded and never returns stale state.
 */
const sweepExpiredStates = (): void => {
    const now = Date.now();
    for (const [state, entry] of pendingStates) {
        if (now - entry.createdAt > STATE_TTL_MS) {
            pendingStates.delete(state);
        }
    }
};

/**
 * Generates a cryptographically unpredictable CSRF `state` token and stores
 * it with a creation timestamp for later validation.
 *
 * @returns a 64-character hex-encoded random state value
 */
const generateState = (): string => {
    sweepExpiredStates();
    const state = randomBytes(32).toString('hex');
    pendingStates.set(state, { createdAt: Date.now() });
    return state;
};

/**
 * Validates a `state` value returned by MercadoLibre on the OAuth callback
 * and consumes it (one-time use — a state can never be replayed). Also
 * sweeps expired entries as a side effect of the lookup.
 *
 * Intended for the (separate, future) callback route to import and call
 * before exchanging the authorization `code`.
 *
 * @param state - the `state` query param received on the callback request
 * @returns `true` when the state is known and not expired (and consumes it); `false` otherwise
 */
export const validateAndConsumeState = (state: string): boolean => {
    sweepExpiredStates();
    const entry = pendingStates.get(state);
    if (!entry) {
        return false;
    }
    pendingStates.delete(state);
    return true;
};

/**
 * Documentation-only response schema. The handler always returns a raw 302
 * redirect `Response` (see `createCRUDRoute`'s `instanceof Response`
 * short-circuit in route-factory.ts), so this schema is never used to
 * serialize a runtime response — it exists purely so the OpenAPI docs
 * describe the intended shape.
 */
const AuthorizeRedirectDocsSchema = z.object({
    redirectUrl: z.string().url()
});

/**
 * GET /api/v1/admin/mercadolibre-oauth/authorize
 *
 * Redirects the authenticated admin operator to MercadoLibre's OAuth
 * authorization page, with a freshly generated CSRF `state` param and the
 * app's registered `client_id` / `redirect_uri`.
 *
 * Requires {@link PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE}.
 */
export const mercadoLibreAuthorizeRoute = createAdminRoute({
    method: 'get',
    path: '/authorize',
    summary: 'Start MercadoLibre OAuth flow',
    description:
        'Redirects the admin operator to the MercadoLibre OAuth authorization page with a CSRF state token. The paired callback route (T-012) is not yet built.',
    tags: ['Integrations'],
    requiredPermissions: [PermissionEnum.INTEGRATION_MERCADOLIBRE_MANAGE],
    responseSchema: AuthorizeRedirectDocsSchema,
    handler: async (c) => {
        if (!env.HOSPEDA_MERCADOLIBRE_CLIENT_ID || !env.HOSPEDA_MERCADOLIBRE_REDIRECT_URI) {
            throw new HTTPException(503, {
                message: 'MercadoLibre OAuth integration is not configured'
            });
        }

        const state = generateState();

        const authorizeUrl = new URL(MERCADOLIBRE_AUTHORIZATION_URL);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('client_id', env.HOSPEDA_MERCADOLIBRE_CLIENT_ID);
        authorizeUrl.searchParams.set('redirect_uri', env.HOSPEDA_MERCADOLIBRE_REDIRECT_URI);
        authorizeUrl.searchParams.set('state', state);

        return c.redirect(authorizeUrl.toString(), 302);
    }
});
