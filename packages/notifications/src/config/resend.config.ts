import { Resend } from 'resend';

/**
 * Creates a Resend client instance
 *
 * @returns Configured Resend client
 * @throws {Error} If RESEND_API_KEY is not set in environment
 *
 * @example
 * ```ts
 * const resend = createResendClient();
 * await resend.emails.send({
 *   from: 'noreply@hospeda.com.ar',
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * });
 * ```
 */
export function createResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
    }

    return new Resend(apiKey);
}
