import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

/**
 * Public type alias for the configured email client used by the notifications
 * package. Internally this is the Brevo `TransactionalEmailsApi`, but
 * consumers should treat it as opaque so a future provider swap stays
 * transparent.
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
 * Creates an email client instance using dependency-injected configuration.
 *
 * @param input - Configuration with API key
 * @returns Configured email client
 *
 * @example
 * ```ts
 * const client = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
 * const transport = new BrevoEmailTransport(client, {
 *   fromEmail: 'noreply@hospeda.com.ar',
 *   fromName: 'Hospeda'
 * });
 * ```
 */
export function createEmailClient({ apiKey }: CreateEmailClientInput): EmailClient {
    const api = new TransactionalEmailsApi();
    api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
    return api;
}

/**
 * @deprecated Use `createEmailClient` instead. Kept as a re-export so call
 * sites that still import the Resend-named factory keep compiling during the
 * migration.
 */
export const createResendClient = createEmailClient;

/**
 * @deprecated Use `CreateEmailClientInput` instead.
 */
export type CreateResendClientInput = CreateEmailClientInput;
