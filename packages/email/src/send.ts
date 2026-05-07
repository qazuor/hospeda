import { SendSmtpEmail } from '@getbrevo/brevo';
import { render } from '@react-email/render';
import { createLogger } from '@repo/logger';
import type { ReactElement } from 'react';
import type { EmailClient } from './client.js';

const logger = createLogger('email');

/**
 * Default sender used when the caller does not specify one. The address must
 * belong to a domain authenticated in the email provider (Brevo) — otherwise
 * delivery fails or lands in spam.
 */
const DEFAULT_FROM_EMAIL = 'noreply@hospeda.com.ar';
const DEFAULT_FROM_NAME = 'Hospeda';

/**
 * Input parameters for sending an email.
 */
export interface SendEmailInput {
    /**
     * Configured email client instance (dependency-injected).
     */
    readonly client: EmailClient;

    /**
     * Recipient email address(es).
     * Can be a single email or array of emails.
     */
    readonly to: string | readonly string[];

    /**
     * Email subject line.
     */
    readonly subject: string;

    /**
     * React Email component to render as email body. The component is
     * rendered to HTML at send time.
     */
    readonly react: ReactElement;

    /**
     * Sender email address. Must be on a domain authenticated in the email
     * provider. Defaults to `noreply@hospeda.com.ar`.
     */
    readonly fromEmail?: string;

    /**
     * Sender display name. Defaults to `Hospeda`.
     */
    readonly fromName?: string;

    /**
     * Reply-to email address. When omitted, replies go to the sender address.
     */
    readonly replyTo?: string;
}

/**
 * Result of sending an email operation.
 */
export interface SendEmailResult {
    /**
     * Whether the email was accepted by the provider.
     */
    readonly success: boolean;

    /**
     * Provider-assigned message ID (on success). Format depends on the
     * provider; Brevo emits an RFC-2822 Message-Id like
     * `<202401151234.abc123@smtp-relay.brevo.com>`.
     */
    readonly messageId?: string;

    /**
     * Error message (on failure).
     */
    readonly error?: string;
}

/**
 * Send an email through the configured provider.
 *
 * The function never throws: provider failures, network errors and rendering
 * errors are caught and surfaced via the `success`/`error` fields of the
 * result. Callers are expected to log/branch on the result rather than wrap
 * the call in try/catch.
 *
 * @param input - Email configuration (to, subject, react component, etc.)
 * @returns Result object with success status and message ID or error
 *
 * @example
 * ```ts
 * import { sendEmail } from '@repo/email';
 * import { VerifyEmailTemplate } from '@repo/email';
 *
 * const result = await sendEmail({
 *   client,
 *   to: 'user@example.com',
 *   subject: 'Verify your email',
 *   react: VerifyEmailTemplate({
 *     name: 'John Doe',
 *     verificationUrl: 'https://example.com/verify?token=abc123'
 *   })
 * });
 *
 * if (!result.success) {
 *   logger.error('Failed to send email:', result.error);
 * }
 * ```
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const {
        client,
        to,
        subject,
        react,
        fromEmail = DEFAULT_FROM_EMAIL,
        fromName = DEFAULT_FROM_NAME,
        replyTo
    } = input;

    try {
        const htmlContent = await render(react);

        const message = new SendSmtpEmail();
        message.subject = subject;
        message.htmlContent = htmlContent;
        message.sender = { email: fromEmail, name: fromName };
        message.to = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
        if (replyTo) {
            message.replyTo = { email: replyTo };
        }

        const response = await client.sendTransacEmail(message);
        const messageId = response.body?.messageId;
        return { success: true, ...(messageId ? { messageId } : {}) };
    } catch (err) {
        // Brevo SDK surfaces structured errors via `err.body`; fall back to
        // `err.message` and finally a generic label so callers always get a
        // string they can log.
        const fromBody =
            err && typeof err === 'object' && 'body' in err && err.body
                ? typeof err.body === 'string'
                    ? err.body
                    : JSON.stringify(err.body)
                : null;
        const message = fromBody ?? (err instanceof Error ? err.message : 'Unknown error');
        logger.error('Failed to send:', message);
        return { success: false, error: message };
    }
}
