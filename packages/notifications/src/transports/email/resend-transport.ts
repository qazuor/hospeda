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
 * Sends emails via Brevo's transactional REST API (`POST /v3/smtp/email`)
 * using `fetch` directly. We avoid the official `@getbrevo/brevo` SDK
 * because it transitively pulls in `axios` -> `form-data` -> `combined-stream`,
 * which use CommonJS `require('util')` and crash under ESM bundling.
 *
 * The class is exported as `BrevoEmailTransport`. The legacy alias
 * `ResendEmailTransport` is retained as a deprecated re-export so existing
 * call sites keep compiling during the migration; new code should import
 * `BrevoEmailTransport`.
 *
 * @example
 * ```ts
 * import { createEmailClient, BrevoEmailTransport } from '@repo/notifications';
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
     * @param client - Configured email client
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
     * @throws {Error} If Brevo returns an error response or `fetch` rejects
     */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        try {
            const htmlContent = await render(input.react);

            const body: Record<string, unknown> = {
                sender: parseSender(input.from, this.defaultFromEmail, this.defaultFromName),
                to: [{ email: input.to }],
                subject: input.subject,
                htmlContent
            };

            if (input.replyTo) {
                body.replyTo = { email: input.replyTo };
            }

            if (input.tags && input.tags.length > 0) {
                // Brevo only accepts string tags; encode `name:value` pairs.
                body.tags = input.tags.map((t) => `${t.name}:${t.value}`);
            }

            if (input.attachments && input.attachments.length > 0) {
                body.attachment = input.attachments.map((att) => ({
                    name: att.filename,
                    content:
                        typeof att.content === 'string'
                            ? att.content
                            : att.content.toString('base64')
                }));
            }

            const response = await fetch(`${this.client.baseUrl}/smtp/email`, {
                method: 'POST',
                headers: {
                    'api-key': this.client.apiKey,
                    'content-type': 'application/json',
                    accept: 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const detail = await extractErrorDetail(response);
                throw new Error(`Failed to send email via Brevo: ${detail}`);
            }

            const data = (await response.json()) as { messageId?: string };
            if (!data.messageId) {
                throw new Error('Failed to send email via Brevo: response missing message ID');
            }
            return { messageId: data.messageId };
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.startsWith('Failed to send email via Brevo')
            ) {
                throw error;
            }
            const detail = error instanceof Error ? error.message : 'Unknown error';
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
 * Extract a human-readable error detail from a Brevo error response. Falls
 * back to status / status text when the body cannot be parsed as JSON.
 */
async function extractErrorDetail(response: Response): Promise<string> {
    try {
        const errorJson = (await response.json()) as { message?: string; code?: string };
        if (errorJson.message) {
            return errorJson.message;
        }
    } catch {
        // ignore — fall through to status-based detail
    }
    return `${response.status} ${response.statusText || 'error'}`;
}
