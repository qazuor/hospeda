import { Resend } from 'resend';

/**
 * Lazy-initialized Resend client singleton.
 * @internal
 */
let resendClient: Resend | null = null;

/**
 * Get the Resend client instance.
 * Initializes on first call using HOSPEDA_RESEND_API_KEY environment variable.
 *
 * @returns Configured Resend client instance
 * @throws {Error} If HOSPEDA_RESEND_API_KEY environment variable is not set
 *
 * @example
 * ```ts
 * const client = getResendClient();
 * await client.emails.send({ ... });
 * ```
 */
export function getResendClient(): Resend {
    if (!resendClient) {
        const apiKey = process.env.HOSPEDA_RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('HOSPEDA_RESEND_API_KEY environment variable is required');
        }
        resendClient = new Resend(apiKey);
    }
    return resendClient;
}

/**
 * Reset the Resend client instance.
 * Useful for testing or when credentials need to be refreshed.
 *
 * @example
 * ```ts
 * // In test cleanup
 * afterEach(() => {
 *   resetResendClient();
 * });
 * ```
 */
export function resetResendClient(): void {
    resendClient = null;
}
