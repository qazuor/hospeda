import { SendSmtpEmail } from '@getbrevo/brevo';
import { render } from '@react-email/render';
import type { EmailClient } from '../../config/resend.config.js';
import type {
    EmailTransport,
    SendEmailInput,
    SendEmailResult
} from './email-transport.interface.js';

/**
 * Brevo email transport implementation.
 *
 * Sends emails via Brevo's transactional API using React Email components
 * rendered to HTML at send time. Uses dependency injection for the email
 * client to enable testing.
 *
 * The class is exported as `BrevoEmailTransport`. The legacy alias
 * `ResendEmailTransport` is retained as a deprecated re-export so existing
 * call sites keep compiling during the migration; new code should import
 * `BrevoEmailTransport`.
 *
 * @example
 * ```ts
 * import { createEmailClient, BrevoEmailTransport } from '@repo/notifications';
 * import { WelcomeEmail } from './emails/welcome';
 *
 * const client = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
 * const transport = new BrevoEmailTransport(client, {
 *   fromEmail: 'noreply@hospeda.com.ar',
 *   fromName: 'Hospeda'
 * });
 *
 * const result = await transport.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome to Hospeda',
 *   react: <WelcomeEmail userName="John" />
 * });
 * ```
 */
export class BrevoEmailTransport implements EmailTransport {
    private readonly client: EmailClient;
    private readonly defaultFromEmail: string;
    private readonly defaultFromName: string;

    /**
     * Creates a new Brevo email transport.
     *
     * @param client - Configured email client (Brevo TransactionalEmailsApi)
     * @param options - Transport configuration options
     * @param options.fromEmail - Default sender email address (required)
     * @param options.fromName - Default sender display name (required)
     */
    constructor(
        client: EmailClient,
        options: {
            fromEmail: string;
            fromName: string;
        }
    ) {
        this.client = client;
        this.defaultFromEmail = options.fromEmail;
        this.defaultFromName = options.fromName;
    }

    /**
     * Send an email via Brevo.
     *
     * @param input - Email content and metadata
     * @returns Promise resolving to send result with provider message ID
     * @throws {Error} If the Brevo API call fails or returns no message ID
     */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        try {
            const htmlContent = await render(input.react);

            const message = new SendSmtpEmail();
            message.subject = input.subject;
            message.htmlContent = htmlContent;
            message.sender = parseSender(input.from, this.defaultFromEmail, this.defaultFromName);
            message.to = [{ email: input.to }];

            if (input.replyTo) {
                message.replyTo = { email: input.replyTo };
            }

            if (input.tags && input.tags.length > 0) {
                message.tags = input.tags.map((t) => `${t.name}:${t.value}`);
            }

            if (input.attachments && input.attachments.length > 0) {
                message.attachment = input.attachments.map((att) => ({
                    name: att.filename,
                    content:
                        typeof att.content === 'string'
                            ? att.content
                            : att.content.toString('base64')
                }));
            }

            const response = await this.client.sendTransacEmail(message);
            const messageId = response.body?.messageId;

            if (!messageId) {
                throw new Error('Brevo response missing message ID');
            }

            return { messageId };
        } catch (error) {
            const detail = extractErrorDetail(error);
            throw new Error(`Failed to send email via Brevo: ${detail}`);
        }
    }
}

/**
 * @deprecated Use `BrevoEmailTransport` instead. The legacy alias is kept so
 * existing call sites keep compiling during the migration.
 */
export const ResendEmailTransport = BrevoEmailTransport;

/**
 * Parse a `from` value into a Brevo `{ email, name }` sender. The legacy
 * Resend-style format `"Name <email>"` is supported for backward compat with
 * call sites that still pass a combined string.
 */
function parseSender(
    from: string | undefined,
    defaultEmail: string,
    defaultName: string
): { email: string; name?: string } {
    if (!from) {
        return { email: defaultEmail, name: defaultName };
    }

    const match = from.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
    if (match) {
        const [, name, email] = match;
        return { email: email as string, name: name as string };
    }

    return { email: from };
}

/**
 * Extract the most useful error detail from a thrown value. Brevo SDK errors
 * include `err.body` with structured details; everything else falls back to
 * `err.message` and finally a generic label so callers always get a string.
 */
function extractErrorDetail(error: unknown): string {
    if (
        error &&
        typeof error === 'object' &&
        'body' in error &&
        (error as { body: unknown }).body
    ) {
        const body = (error as { body: unknown }).body;
        return typeof body === 'string' ? body : JSON.stringify(body);
    }
    return error instanceof Error ? error.message : 'Unknown error';
}
