import { Resend } from 'resend';

/**
 * Input for creating an email client instance.
 */
export interface CreateEmailClientInput {
    /** Resend API key */
    readonly apiKey: string;
}

/**
 * Creates a Resend client instance using dependency-injected configuration.
 *
 * The caller is responsible for reading the API key from environment variables
 * or another configuration source and passing it here.
 *
 * @param input - Configuration with API key
 * @returns Configured Resend client instance
 *
 * @example
 * ```ts
 * const client = createEmailClient({ apiKey: env.HOSPEDA_RESEND_API_KEY });
 * await client.emails.send({ ... });
 * ```
 */
export function createEmailClient({ apiKey }: CreateEmailClientInput): Resend {
    return new Resend(apiKey);
}
