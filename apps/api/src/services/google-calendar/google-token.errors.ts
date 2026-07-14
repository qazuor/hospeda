/**
 * Typed errors for the Google Calendar OAuth token service (HOS-157 Phase 2).
 *
 * The token service refreshes Google access tokens transparently using a
 * stored refresh token. Failures during that refresh fall into two categories
 * that downstream callers (the sync service, the connect/sync routes) need to
 * react to differently:
 *
 * - `terminal`: Google rejected the refresh token itself (e.g. the host
 *   revoked calendar access, or the token expired from inactivity). Retrying
 *   with the same refresh token will never succeed — the host must re-run the
 *   connect (consent) flow. The caller surfaces this by marking the connection
 *   `ERROR` so the host UI prompts a reconnect.
 * - `transient`: A network error, timeout, or a Google-side outage (5xx). Safe
 *   to retry on the next sync tick without prompting the host.
 *
 * Unlike the MercadoLibre precedent, a terminal failure here is scoped to a
 * SINGLE host's accommodation connection (not a global import tier), so this
 * module fires no admin alert — the caller records the error on that
 * connection's sync state instead.
 *
 * @module services/google-calendar/google-token.errors
 */

/** Discriminates whether a token refresh failure requires host re-authorization. */
export type GoogleTokenRefreshErrorKind = 'terminal' | 'transient';

/**
 * Known Google OAuth error codes that indicate the refresh token itself is
 * invalid (as opposed to a transport-level failure).
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */
const TERMINAL_OAUTH_ERROR_CODES: ReadonlySet<string> = new Set([
    'invalid_grant',
    'invalid_client'
]);

/** HTTP status codes from the Google token endpoint that are never worth retrying as-is. */
const TERMINAL_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([400, 401, 403, 404]);

/**
 * Error thrown by the Google Calendar OAuth token service when refreshing the
 * access token fails.
 *
 * @example
 * ```ts
 * throw new GoogleTokenRefreshError('Google rejected the refresh token', 'terminal', { cause: originalError });
 * ```
 */
export class GoogleTokenRefreshError extends Error {
    /**
     * Whether this failure requires host re-authorization (`terminal`) or can
     * be safely retried later (`transient`).
     */
    public readonly kind: GoogleTokenRefreshErrorKind;

    /**
     * Creates a new `GoogleTokenRefreshError`.
     *
     * @param message - Human-readable description of the failure
     * @param kind - `'terminal'` if re-authorization is required, `'transient'` if safe to retry
     * @param options - Optional error-cause chaining metadata
     */
    constructor(message: string, kind: GoogleTokenRefreshErrorKind, options?: { cause?: unknown }) {
        super(message, { cause: options?.cause });
        this.name = 'GoogleTokenRefreshError';
        this.kind = kind;
    }
}

/**
 * Shape-checks an unknown value for an HTTP status number at `status` or
 * `response.status`. Defensive: both common conventions are checked so this
 * works regardless of which error shape the OAuth client surfaces.
 *
 * @param error - The unknown error to inspect
 * @returns The numeric HTTP status if found, otherwise `undefined`
 */
const extractHttpStatus = (error: unknown): number | undefined => {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
        return (error as { status: number }).status;
    }

    if ('response' in error) {
        const response = (error as { response: unknown }).response;
        if (
            typeof response === 'object' &&
            response !== null &&
            'status' in response &&
            typeof (response as { status: unknown }).status === 'number'
        ) {
            return (response as { status: number }).status;
        }
    }

    return undefined;
};

/**
 * Shape-checks an unknown value for a Google OAuth error code nested under a
 * `body` or `data` field (e.g. `{ body: { error: 'invalid_grant' } }`).
 *
 * @param error - The unknown error to inspect
 * @returns The OAuth error code string if found, otherwise `undefined`
 */
const extractOAuthErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    for (const field of ['body', 'data'] as const) {
        if (!(field in error)) {
            continue;
        }

        const payload = (error as Record<string, unknown>)[field];
        if (
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error: unknown }).error === 'string'
        ) {
            return (payload as { error: string }).error;
        }
    }

    return undefined;
};

/**
 * Classifies an unknown error raised while refreshing a Google access token
 * into a `GoogleTokenRefreshError` with the correct `kind`.
 *
 * Defaults to `'transient'` whenever the failure cannot be confidently
 * identified as a rejection of the refresh token itself — falsely treating a
 * fixable network blip as terminal would wrongly prompt the host to reconnect,
 * while the reverse (missing a real terminal failure) only delays the reconnect
 * prompt until the next refresh attempt.
 *
 * @param error - The unknown error caught while calling the Google token endpoint
 * @returns A classified `GoogleTokenRefreshError` wrapping the original error as `cause`
 *
 * @example
 * ```ts
 * try {
 *   await refreshAccessToken({ refreshToken });
 * } catch (error) {
 *   throw classifyGoogleRefreshFailure(error);
 * }
 * ```
 */
export const classifyGoogleRefreshFailure = (error: unknown): GoogleTokenRefreshError => {
    if (error instanceof GoogleTokenRefreshError) {
        return error;
    }

    const status = extractHttpStatus(error);
    const oauthErrorCode = extractOAuthErrorCode(error);

    const isTerminal =
        (status !== undefined && TERMINAL_HTTP_STATUS_CODES.has(status)) ||
        (oauthErrorCode !== undefined && TERMINAL_OAUTH_ERROR_CODES.has(oauthErrorCode));

    if (isTerminal) {
        const reason = oauthErrorCode ?? `HTTP ${String(status)}`;
        return new GoogleTokenRefreshError(
            `Google rejected the refresh token (${reason}) — the host must reconnect the calendar`,
            'terminal',
            { cause: error }
        );
    }

    const baseMessage = error instanceof Error ? error.message : 'unknown error';
    return new GoogleTokenRefreshError(
        `Google token refresh failed transiently: ${baseMessage}`,
        'transient',
        { cause: error }
    );
};
