import { render } from '@react-email/render';
import type { EmailClient } from '../../config/resend.config.js';
import { EmailHardBounceError } from '../../services/outbox/email-outbox-delivery.service.js';
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
    private readonly subjectPrefix: string | undefined;

    /**
     * Creates a new Brevo email transport.
     *
     * @param client - Configured email client
     * @param options - Transport configuration options
     * @param options.fromEmail - Default sender email address (required)
     * @param options.fromName - Default sender display name (required)
     * @param options.subjectPrefix - Optional marker prepended to every subject
     *   (including its trailing space). Used to make the originating
     *   deployment visible in the inbox; omitted on production.
     */
    constructor(
        client: EmailClient,
        options: {
            fromEmail: string;
            fromName: string;
            subjectPrefix?: string | undefined;
        }
    ) {
        this.client = client;
        this.defaultFromEmail = options.fromEmail;
        this.defaultFromName = options.fromName;
        this.subjectPrefix = options.subjectPrefix;
    }

    /**
     * Send an email via Brevo.
     *
     * @param input - Email content and metadata
     * @returns Promise resolving to send result with provider message ID
     * @throws {EmailHardBounceError} If Brevo refuses the recipient address
     *   itself (see {@link isBrevoSynchronousHardBounce})
     * @throws {Error} If Brevo returns any other error response or `fetch` rejects
     */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        try {
            const htmlContent = await render(input.react);

            const body: Record<string, unknown> = {
                sender: parseSender(input.from, this.defaultFromEmail, this.defaultFromName),
                to: [{ email: input.to }],
                subject: this.subjectPrefix
                    ? `${this.subjectPrefix}${input.subject}`
                    : input.subject,
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
                const failure = await readErrorBody(response);
                if (isBrevoSynchronousHardBounce(failure)) {
                    throw new EmailHardBounceError(
                        `Brevo rejected the recipient address: ${failure.message}`
                    );
                }
                throw new Error(`Failed to send email via Brevo: ${failure.detail}`);
            }

            const data = (await response.json()) as { messageId?: string };
            if (!data.messageId) {
                throw new Error('Failed to send email via Brevo: response missing message ID');
            }
            return { messageId: data.messageId };
        } catch (error) {
            if (error instanceof EmailHardBounceError) {
                throw error;
            }
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

/** A Brevo error response, read once. */
export interface BrevoErrorBody {
    /** HTTP status of the response. */
    readonly status: number;
    /** Brevo error `code` (e.g. `invalid_parameter`), when the body carries one. */
    readonly code: string | null;
    /** Brevo error `message`, when the body carries one. */
    readonly message: string | null;
    /** Human-readable detail: the message, or status and status text. */
    readonly detail: string;
}

/**
 * Brevo's message for a `to` address it refuses as invalid. The transport
 * sends exactly one `to` recipient per request, so this message can only
 * name the recipient of this mail.
 */
const BREVO_INVALID_RECIPIENT_MESSAGE = /\bemail is not valid in to\b/i;

/**
 * Whether a Brevo `POST /smtp/email` error is a SYNCHRONOUS hard bounce: the
 * provider refuses the recipient address itself, so no retry can deliver it
 * (HOS-1627, AC:U2:12).
 *
 * Brevo's API reference documents only a generic `400` for this endpoint and
 * no "bounce" response; a mail to an address Brevo already blocks is accepted
 * (`201`) and reported later through the webhook. The only synchronous refusal
 * of the address is the `400` with code `invalid_parameter` and the message
 * `email is not valid in to`. The match is deliberately narrow: a false
 * positive suppresses the address forever, while a miss only costs retries
 * that end as `retries_exhausted`. Every other refusal (other `400`s, `401`,
 * `429`, `5xx`, network errors) stays a retryable error.
 *
 * @param input - The status, code and message of the error response.
 * @returns `true` when the response is a synchronous hard bounce.
 */
export function isBrevoSynchronousHardBounce(
    input: Pick<BrevoErrorBody, 'status' | 'code' | 'message'>
): input is Pick<BrevoErrorBody, 'status' | 'code'> & { readonly message: string } {
    return (
        input.status === 400 &&
        input.code === 'invalid_parameter' &&
        typeof input.message === 'string' &&
        BREVO_INVALID_RECIPIENT_MESSAGE.test(input.message)
    );
}

/**
 * Reads a Brevo error response once. Falls back to status / status text when
 * the body cannot be parsed as JSON.
 */
async function readErrorBody(response: Response): Promise<BrevoErrorBody> {
    let code: string | null = null;
    let message: string | null = null;
    try {
        const errorJson = (await response.json()) as { message?: unknown; code?: unknown };
        code = typeof errorJson.code === 'string' ? errorJson.code : null;
        message = typeof errorJson.message === 'string' ? errorJson.message : null;
    } catch {
        // ignore — fall through to status-based detail
    }
    return {
        status: response.status,
        code,
        message,
        detail: message || `${response.status} ${response.statusText || 'error'}`
    };
}
