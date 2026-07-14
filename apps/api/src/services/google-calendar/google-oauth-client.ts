/**
 * Google Calendar OAuth token client (HOS-157 Phase 2 — Layer 2).
 *
 * Thin native-`fetch` client over Google's OAuth 2.0 token endpoint
 * (`https://oauth2.googleapis.com/token`). Exposes the two grants the calendar
 * sync flow needs: {@link exchangeAuthorizationCode} (initial connect) and
 * {@link refreshAccessToken} (silent renewal). Deliberately mirrors the
 * MercadoLibre precedent in `services/mercadolibre-oauth/ml-oauth-client.ts`,
 * with one provider-specific difference documented below.
 *
 * ## Google-specific behaviour: refresh grant omits the refresh token
 *
 * Per Google's OAuth 2.0 docs, a `grant_type=authorization_code` exchange
 * returns a `refresh_token` ONLY when the original authorization request used
 * `access_type=offline` (and typically `prompt=consent`). A subsequent
 * `grant_type=refresh_token` response does NOT echo a new refresh token — the
 * originally-issued one stays valid until revoked/expired. Google refresh
 * tokens are therefore NOT single-use (unlike MercadoLibre's rotating ones).
 * {@link GoogleTokenResponse.refreshToken} is consequently OPTIONAL, and the
 * token service must preserve the stored refresh token when a refresh response
 * omits it. Verified against
 * https://developers.google.com/identity/protocols/oauth2/web-server
 * ("Token Exchange → Response Fields" and "Refresh an access token").
 *
 * @module services/google-calendar/google-oauth-client
 */

import { env } from '../../utils/env.js';

/** Google's OAuth 2.0 token endpoint (grant exchange + refresh). */
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Normalized (camelCase) shape of a Google OAuth token response.
 *
 * The raw Google response uses snake_case field names (`access_token`,
 * `refresh_token`, `expires_in`, `token_type`, `scope`);
 * {@link exchangeAuthorizationCode} and {@link refreshAccessToken} map the raw
 * response into this shape so snake_case never leaks past this module.
 */
export interface GoogleTokenResponse {
    /** Short-lived bearer token used to authenticate calls to the Google Calendar API. */
    readonly accessToken: string;
    /**
     * Long-lived token used to obtain a new access token without user
     * interaction. Present on the initial `authorization_code` exchange (when
     * `access_type=offline` was requested); ABSENT on `refresh_token` grants,
     * hence optional. Callers must preserve the previously-stored refresh
     * token when this is `undefined`.
     */
    readonly refreshToken?: string;
    /** Access token lifetime, in seconds, from the moment it was issued. */
    readonly expiresIn: number;
    /** Token type returned by Google (typically `"Bearer"`). */
    readonly tokenType: string;
    /** Space-separated list of scopes actually granted, when reported. */
    readonly scope?: string;
}

/**
 * Input for {@link exchangeAuthorizationCode}.
 */
export interface ExchangeAuthorizationCodeInput {
    /** The one-time authorization code returned by Google's OAuth consent redirect. */
    readonly code: string;
    /** The redirect URI registered on the Google OAuth client, echoed back for verification. */
    readonly redirectUri: string;
}

/**
 * Input for {@link refreshAccessToken}.
 */
export interface RefreshAccessTokenInput {
    /** The refresh token previously issued by Google. */
    readonly refreshToken: string;
}

/**
 * Raw (snake_case) shape of a successful Google OAuth token response. Not
 * exported — callers only ever see the camelCase {@link GoogleTokenResponse}.
 * `refresh_token` and `scope` are optional (see the module doc).
 */
interface RawGoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
}

/**
 * Structured error thrown by this client for any non-2xx response from the
 * Google OAuth token endpoint.
 *
 * @remarks
 * Never construct this error with `client_secret` embedded in the message —
 * this client itself never includes `client_secret` in the message or in the
 * parsed body it attaches.
 */
export class GoogleOAuthClientError extends Error {
    /** HTTP status code returned by the Google OAuth endpoint. */
    public readonly status: number;
    /** Parsed JSON error body, when the response body was valid JSON; otherwise `undefined`. */
    public readonly body?: Record<string, unknown>;

    constructor(message: string, status: number, body?: Record<string, unknown>) {
        super(message);
        this.name = 'GoogleOAuthClientError';
        this.status = status;
        this.body = body;
    }
}

/**
 * Attempts to parse a fetch `Response` body as JSON, returning `undefined`
 * if the body is empty or not valid JSON. Used to attach structured error
 * detail to {@link GoogleOAuthClientError} without throwing a secondary parse
 * error.
 *
 * @param response - The fetch `Response` to parse
 * @returns The parsed JSON body, or `undefined` if unparseable
 */
const tryParseJson = async (response: Response): Promise<Record<string, unknown> | undefined> => {
    try {
        const text = await response.text();
        if (!text) {
            return undefined;
        }
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

/**
 * Maps a raw (snake_case) Google token response into the normalized camelCase
 * {@link GoogleTokenResponse} shape used throughout the app.
 *
 * @param raw - The raw JSON response body from the Google OAuth token endpoint
 * @returns The normalized token response
 */
const mapRawTokenResponse = (raw: RawGoogleTokenResponse): GoogleTokenResponse => ({
    accessToken: raw.access_token,
    ...(raw.refresh_token === undefined ? {} : { refreshToken: raw.refresh_token }),
    expiresIn: raw.expires_in,
    tokenType: raw.token_type,
    ...(raw.scope === undefined ? {} : { scope: raw.scope })
});

/**
 * Sends a `POST` request to the Google OAuth token endpoint with the given
 * form-encoded body, and returns the normalized token response.
 *
 * @param body - The `application/x-www-form-urlencoded` request body
 * @returns The normalized {@link GoogleTokenResponse}
 * @throws {GoogleOAuthClientError} If the response status is not in the 2xx range
 */
const postTokenRequest = async (body: URLSearchParams): Promise<GoogleTokenResponse> => {
    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
        },
        body: body.toString()
    });

    if (!response.ok) {
        const parsedBody = await tryParseJson(response);
        // Never include client_secret (or any other request param) in the
        // thrown error message — only the HTTP status is echoed here.
        throw new GoogleOAuthClientError(
            `Google OAuth token request failed with status ${response.status}`,
            response.status,
            parsedBody
        );
    }

    const raw = (await response.json()) as RawGoogleTokenResponse;
    return mapRawTokenResponse(raw);
};

/**
 * Exchanges a one-time OAuth authorization code for an access/refresh token
 * pair via Google's `/token` endpoint.
 *
 * @param input - The authorization code and the redirect URI used in the
 * original authorization request
 * @returns The normalized {@link GoogleTokenResponse}. On a successful initial
 * exchange (authorization performed with `access_type=offline`), this includes
 * `refreshToken`.
 * @throws {GoogleOAuthClientError} If Google responds with a non-2xx status
 *
 * @example
 * ```ts
 * const tokens = await exchangeAuthorizationCode({
 *   code: '4/0Ab...',
 *   redirectUri: 'https://api.hospeda.com.ar/api/v1/protected/accommodations/calendar-sync/google/callback',
 * });
 * ```
 */
export const exchangeAuthorizationCode = async (
    input: ExchangeAuthorizationCodeInput
): Promise<GoogleTokenResponse> => {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID ?? '',
        client_secret: env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
        code: input.code,
        redirect_uri: input.redirectUri
    });

    return postTokenRequest(body);
};

/**
 * Exchanges a previously-issued refresh token for a new access token via
 * Google's `/token` endpoint.
 *
 * Unlike MercadoLibre, Google does NOT rotate the refresh token on this grant:
 * the response omits `refresh_token`, so the returned
 * {@link GoogleTokenResponse.refreshToken} is `undefined` and the caller must
 * keep using the stored one.
 *
 * @param input - The refresh token to redeem
 * @returns The normalized {@link GoogleTokenResponse} (without `refreshToken`)
 * @throws {GoogleOAuthClientError} If Google responds with a non-2xx status
 *
 * @example
 * ```ts
 * const tokens = await refreshAccessToken({ refreshToken: storedRefreshToken });
 * // tokens.refreshToken is undefined — keep the stored one.
 * ```
 */
export const refreshAccessToken = async (
    input: RefreshAccessTokenInput
): Promise<GoogleTokenResponse> => {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_ID ?? '',
        client_secret: env.HOSPEDA_GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
        refresh_token: input.refreshToken
    });

    return postTokenRequest(body);
};
