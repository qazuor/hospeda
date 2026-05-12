/**
 * Public type alias for the configured email client. Implemented as a small
 * config object that the send function uses to build authenticated requests
 * against the provider's REST API. Kept opaque to consumers so a future
 * provider swap stays transparent.
 */
export interface EmailClient {
    /** Provider API key used in `api-key` header on each request. */
    readonly apiKey: string;
    /** Provider base URL (e.g. `https://api.brevo.com/v3`). */
    readonly baseUrl: string;
}

/**
 * Input for creating an email client instance.
 */
export interface CreateEmailClientInput {
    /** Email provider API key (Brevo: starts with `xkeysib-`). */
    readonly apiKey: string;
    /**
     * Override for the provider base URL. Mostly useful for tests pointing at
     * a fake server. Defaults to Brevo production.
     */
    readonly baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://api.brevo.com/v3';

/**
 * Creates an email client using dependency-injected configuration.
 *
 * Returns a plain config object rather than an SDK instance because the
 * Brevo Node SDK pulls in `axios` -> `form-data` -> `combined-stream`, which
 * use CommonJS `require('util')` and fail under ESM bundling. We talk to the
 * REST API directly with `fetch` instead — same surface, zero dynamic
 * requires.
 *
 * @param input - Configuration with API key
 * @returns Configured email client
 *
 * @example
 * ```ts
 * const client = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
 * await sendEmail({ client, to, subject, react });
 * ```
 */
export function createEmailClient({ apiKey, baseUrl }: CreateEmailClientInput): EmailClient {
    return {
        apiKey,
        baseUrl: baseUrl ?? DEFAULT_BASE_URL
    };
}
