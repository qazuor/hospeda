import { env } from '../../utils/env.js';

/**
 * MercadoLibre OAuth token endpoint.
 *
 * @remarks
 * The exact field names/contract below are implemented from the OAuth 2.0
 * spec conventions documented for MercadoLibre's `/oauth/token` endpoint at
 * the time HOS-45 was authored. They have NOT been verified against a live
 * sandbox call. Re-verify against https://developers.mercadolibre.com.ar
 * (Authentication and Authorization → OAuth 2.0) before relying on this
 * client in production, and update this comment once confirmed.
 */
const ML_OAUTH_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

/**
 * Normalized (camelCase) shape of a MercadoLibre OAuth token response.
 *
 * The raw ML API response uses snake_case field names (`access_token`,
 * `refresh_token`, `expires_in`, `token_type`); {@link exchangeAuthorizationCode}
 * and {@link refreshAccessToken} map the raw response into this shape so
 * snake_case never leaks past this module.
 */
export interface MLTokenResponse {
    /** Short-lived bearer token used to authenticate calls to the ML API. */
    readonly accessToken: string;
    /** Long-lived token used to obtain a new access token without user interaction. */
    readonly refreshToken: string;
    /** Access token lifetime, in seconds, from the moment it was issued. */
    readonly expiresIn: number;
    /** Token type returned by MercadoLibre (typically `"bearer"`). */
    readonly tokenType: string;
}

/**
 * Input for {@link exchangeAuthorizationCode}.
 */
export interface ExchangeAuthorizationCodeInput {
    /** The one-time authorization code returned by ML's OAuth consent redirect. */
    readonly code: string;
    /** The redirect URI registered on the ML app, echoed back for verification. */
    readonly redirectUri: string;
}

/**
 * Input for {@link refreshAccessToken}.
 */
export interface RefreshAccessTokenInput {
    /** The refresh token previously issued by MercadoLibre. */
    readonly refreshToken: string;
}

/**
 * Raw (snake_case) shape of a successful MercadoLibre OAuth token response,
 * as documented by ML's OAuth 2.0 token endpoint contract. Not exported —
 * callers only ever see the camelCase {@link MLTokenResponse}.
 */
interface RawMLTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}

/**
 * Structured error thrown by this client for any non-2xx response from the
 * MercadoLibre OAuth token endpoint.
 *
 * @remarks
 * Never construct this error with `client_secret` embedded in the message —
 * callers of this module must treat the `body` field as potentially
 * containing request-echo data too, but this client itself never includes
 * `client_secret` in the message or in the parsed body it attaches.
 */
export class MLOAuthClientError extends Error {
    /** HTTP status code returned by the MercadoLibre OAuth endpoint. */
    public readonly status: number;
    /** Parsed JSON error body, when the response body was valid JSON; otherwise `undefined`. */
    public readonly body?: Record<string, unknown>;

    constructor(message: string, status: number, body?: Record<string, unknown>) {
        super(message);
        this.name = 'MLOAuthClientError';
        this.status = status;
        this.body = body;
    }
}

/**
 * Attempts to parse a fetch `Response` body as JSON, returning `undefined`
 * if the body is empty or not valid JSON. Used to attach structured error
 * detail to {@link MLOAuthClientError} without throwing a secondary parse error.
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
 * Maps a raw (snake_case) MercadoLibre token response into the normalized
 * camelCase {@link MLTokenResponse} shape used throughout the app.
 *
 * @param raw - The raw JSON response body from the ML OAuth token endpoint
 * @returns The normalized token response
 */
const mapRawTokenResponse = (raw: RawMLTokenResponse): MLTokenResponse => ({
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in,
    tokenType: raw.token_type
});

/**
 * Sends a `POST` request to the MercadoLibre OAuth token endpoint with the
 * given form-encoded body, and returns the normalized token response.
 *
 * @param body - The `application/x-www-form-urlencoded` request body
 * @returns The normalized {@link MLTokenResponse}
 * @throws {MLOAuthClientError} If the response status is not in the 2xx range
 */
const postTokenRequest = async (body: URLSearchParams): Promise<MLTokenResponse> => {
    const response = await fetch(ML_OAUTH_TOKEN_URL, {
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
        throw new MLOAuthClientError(
            `MercadoLibre OAuth token request failed with status ${response.status}`,
            response.status,
            parsedBody
        );
    }

    const raw = (await response.json()) as RawMLTokenResponse;
    return mapRawTokenResponse(raw);
};

/**
 * Exchanges a one-time OAuth authorization code for an access/refresh token
 * pair via MercadoLibre's `/oauth/token` endpoint.
 *
 * @param input - The authorization code and the redirect URI used in the
 * original authorization request
 * @returns The normalized {@link MLTokenResponse}
 * @throws {MLOAuthClientError} If MercadoLibre responds with a non-2xx status
 *
 * @example
 * ```ts
 * const tokens = await exchangeAuthorizationCode({
 *   code: 'TG-abc123',
 *   redirectUri: 'https://api.hospeda.com.ar/api/v1/admin/mercadolibre/callback',
 * });
 * ```
 */
export const exchangeAuthorizationCode = async (
    input: ExchangeAuthorizationCodeInput
): Promise<MLTokenResponse> => {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.HOSPEDA_MERCADOLIBRE_CLIENT_ID ?? '',
        client_secret: env.HOSPEDA_MERCADOLIBRE_CLIENT_SECRET ?? '',
        code: input.code,
        redirect_uri: input.redirectUri
    });

    return postTokenRequest(body);
};

/**
 * Exchanges a previously-issued refresh token for a new access/refresh token
 * pair via MercadoLibre's `/oauth/token` endpoint (refresh-token rotation).
 *
 * @param input - The refresh token to redeem
 * @returns The normalized {@link MLTokenResponse}
 * @throws {MLOAuthClientError} If MercadoLibre responds with a non-2xx status
 *
 * @example
 * ```ts
 * const tokens = await refreshAccessToken({ refreshToken: storedRefreshToken });
 * ```
 */
export const refreshAccessToken = async (
    input: RefreshAccessTokenInput
): Promise<MLTokenResponse> => {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.HOSPEDA_MERCADOLIBRE_CLIENT_ID ?? '',
        client_secret: env.HOSPEDA_MERCADOLIBRE_CLIENT_SECRET ?? '',
        refresh_token: input.refreshToken
    });

    return postTokenRequest(body);
};
