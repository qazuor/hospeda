/**
 * Typed errors for the MercadoLibre OAuth token service.
 *
 * The token service refreshes ML access tokens transparently using a stored
 * refresh token. Failures during that refresh fall into two categories that
 * downstream callers (cron jobs, admin alerting) need to react to
 * differently:
 *
 * - `terminal`: MercadoLibre rejected the refresh token itself. Retrying
 *   with the same refresh token will never succeed — an operator must
 *   re-authorize the integration via the OAuth admin endpoint.
 * - `transient`: A network error, timeout, or a MercadoLibre-side outage
 *   (5xx). Safe to retry later without paging anyone.
 */

/** Discriminates whether a token refresh failure requires human intervention. */
export type MLTokenRefreshErrorKind = 'terminal' | 'transient';

/**
 * Known MercadoLibre OAuth error codes that indicate the refresh token
 * itself is invalid (as opposed to a transport-level failure).
 *
 * @see https://developers.mercadolibre.com.ar/en_us/authentication-and-authorization
 */
const TERMINAL_OAUTH_ERROR_CODES: ReadonlySet<string> = new Set([
    'invalid_grant',
    'invalid_client'
]);

/** HTTP status codes from the ML token endpoint that are never worth retrying as-is. */
const TERMINAL_HTTP_STATUS_CODES: ReadonlySet<number> = new Set([400, 401, 403, 404]);

/**
 * Error thrown by the MercadoLibre OAuth token service when refreshing the
 * access token fails.
 *
 * @example
 * ```ts
 * throw new MLTokenRefreshError('ML rejected the refresh token', 'terminal', { cause: originalError });
 * ```
 */
export class MLTokenRefreshError extends Error {
    /**
     * Whether this failure requires re-authorization (`terminal`) or can be
     * safely retried later (`transient`).
     */
    public readonly kind: MLTokenRefreshErrorKind;

    /**
     * Creates a new `MLTokenRefreshError`.
     *
     * @param message - Human-readable description of the failure
     * @param kind - `'terminal'` if re-authorization is required, `'transient'` if safe to retry
     * @param options - Optional error-cause chaining metadata
     */
    constructor(message: string, kind: MLTokenRefreshErrorKind, options?: { cause?: unknown }) {
        super(message, { cause: options?.cause });
        this.name = 'MLTokenRefreshError';
        this.kind = kind;
    }
}

/**
 * Shape-checks an unknown value for an HTTP status number at `status` or
 * `response.status`. Defensive: the future ML HTTP client's exact error
 * shape does not exist yet, so both common conventions are checked.
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
 * Shape-checks an unknown value for a MercadoLibre OAuth error code nested
 * under a `body` or `data` field (e.g. `{ body: { error: 'invalid_grant' } }`).
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
 * Classifies an unknown error raised while refreshing a MercadoLibre access
 * token into an `MLTokenRefreshError` with the correct `kind`.
 *
 * Defaults to `'transient'` whenever the failure cannot be confidently
 * identified as a rejection of the refresh token itself — falsely treating
 * a fixable network blip as terminal would trigger an unnecessary admin
 * alert, while the reverse (missing a real terminal failure) only delays
 * the alert until the next refresh attempt.
 *
 * @param error - The unknown error caught while calling the ML token endpoint
 * @returns A classified `MLTokenRefreshError` wrapping the original error as `cause`
 *
 * @example
 * ```ts
 * try {
 *   await refreshAccessToken();
 * } catch (error) {
 *   throw classifyMLRefreshFailure(error);
 * }
 * ```
 */
export const classifyMLRefreshFailure = (error: unknown): MLTokenRefreshError => {
    if (error instanceof MLTokenRefreshError) {
        return error;
    }

    const status = extractHttpStatus(error);
    const oauthErrorCode = extractOAuthErrorCode(error);

    const isTerminal =
        (status !== undefined && TERMINAL_HTTP_STATUS_CODES.has(status)) ||
        (oauthErrorCode !== undefined && TERMINAL_OAUTH_ERROR_CODES.has(oauthErrorCode));

    if (isTerminal) {
        const reason = oauthErrorCode ?? `HTTP ${String(status)}`;
        return new MLTokenRefreshError(
            `MercadoLibre rejected the refresh token (${reason}) — re-authorization required`,
            'terminal',
            { cause: error }
        );
    }

    const baseMessage = error instanceof Error ? error.message : 'unknown error';
    return new MLTokenRefreshError(
        `MercadoLibre token refresh failed transiently: ${baseMessage}`,
        'transient',
        { cause: error }
    );
};
