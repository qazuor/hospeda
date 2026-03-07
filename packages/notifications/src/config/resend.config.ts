import { Resend } from 'resend';

/**
 * Input for creating a Resend client instance.
 */
export interface CreateResendClientInput {
    /** Resend API key */
    readonly apiKey: string;
}

/**
 * Creates a Resend client instance using dependency-injected configuration.
 *
 * @param input - Configuration with API key
 * @returns Configured Resend client
 *
 * @example
 * ```ts
 * const resend = createResendClient({ apiKey: env.RESEND_API_KEY });
 * await resend.emails.send({
 *   from: 'noreply@hospeda.com.ar',
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * });
 * ```
 */
export function createResendClient({ apiKey }: CreateResendClientInput): Resend {
    return new Resend(apiKey);
}
