import type { Resend } from 'resend';
import { NOTIFICATION_CONSTANTS } from '../../constants/notification.constants.js';
import type {
    EmailTransport,
    SendEmailInput,
    SendEmailResult
} from './email-transport.interface.js';

/**
 * Resend email transport implementation
 *
 * Sends emails using the Resend API with React Email components.
 * Uses dependency injection for the Resend client to enable testing.
 *
 * @example
 * ```ts
 * import { createResendClient } from '@repo/notifications';
 * import { WelcomeEmail } from './emails/welcome';
 *
 * const resend = createResendClient();
 * const transport = new ResendEmailTransport(resend);
 *
 * const result = await transport.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome to Hospeda',
 *   react: <WelcomeEmail userName="John" />
 * });
 *
 * console.log('Email sent:', result.messageId);
 * ```
 */
export class ResendEmailTransport implements EmailTransport {
    private readonly resend: Resend;
    private readonly defaultFrom: string;

    /**
     * Creates a new Resend email transport
     *
     * @param resend - Configured Resend client instance
     * @param options - Transport configuration options
     * @param options.fromEmail - Default sender email (overrides env var)
     * @param options.fromName - Default sender name (overrides env var)
     */
    constructor(
        resend: Resend,
        options?: {
            fromEmail?: string;
            fromName?: string;
        }
    ) {
        this.resend = resend;

        const fromEmail =
            options?.fromEmail ||
            process.env.RESEND_FROM_EMAIL ||
            NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL;

        const fromName =
            options?.fromName ||
            process.env.RESEND_FROM_NAME ||
            NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME;

        this.defaultFrom = `${fromName} <${fromEmail}>`;
    }

    /**
     * Send an email via Resend
     *
     * @param input - Email content and metadata
     * @returns Promise resolving to send result with message ID
     * @throws {Error} If Resend API call fails
     */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        try {
            const response = await this.resend.emails.send({
                from: input.from || this.defaultFrom,
                to: input.to,
                subject: input.subject,
                react: input.react,
                replyTo: input.replyTo,
                tags: input.tags,
                attachments: input.attachments
            });

            // Resend returns { data: { id: string } } on success or { error: Error } on failure
            // TypeScript has trouble narrowing this union, so we check both cases explicitly
            if ('error' in response) {
                const errorResponse = response as { error: Error | string | null };
                const errorMsg =
                    typeof errorResponse.error === 'string'
                        ? errorResponse.error
                        : errorResponse.error?.message || 'Unknown error';
                throw new Error(`Resend API error: ${errorMsg}`);
            }

            const successResponse = response as { data: { id: string } | null };
            if (!successResponse.data?.id) {
                throw new Error('Resend response missing message ID');
            }

            return {
                messageId: successResponse.data.id
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to send email via Resend: ${errorMessage}`);
        }
    }
}
