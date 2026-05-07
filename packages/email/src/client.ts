import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

/**
 * Public type alias for the configured email client. Internally this is the
 * Brevo `TransactionalEmailsApi`, but consumers should treat it as opaque so
 * a future provider swap stays transparent.
 */
export type EmailClient = TransactionalEmailsApi;

/**
 * Input for creating an email client instance.
 */
export interface CreateEmailClientInput {
    /** Email provider API key (Brevo: starts with `xkeysib-`). */
    readonly apiKey: string;
}

/**
 * Creates an email client using dependency-injected configuration.
 *
 * The caller is responsible for reading the API key from environment variables
 * or another configuration source and passing it here.
 *
 * @param input - Configuration with API key
 * @returns Configured email client instance
 *
 * @example
 * ```ts
 * const client = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
 * await sendEmail({ client, to, subject, react });
 * ```
 */
export function createEmailClient({ apiKey }: CreateEmailClientInput): EmailClient {
    const api = new TransactionalEmailsApi();
    api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
    return api;
}
