import { createLogger } from '@repo/logger';
import type { ReactElement } from 'react';
import type { Resend } from 'resend';

const logger = createLogger('email');

/**
 * Input parameters for sending an email.
 */
export interface SendEmailInput {
    /**
     * Configured Resend client instance (dependency-injected).
     */
    readonly client: Resend;

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
     * React Email component to render as email body.
     */
    readonly react: ReactElement;

    /**
     * Sender email address.
     * Defaults to "Hospeda <noreply@hospeda.com.ar>".
     */
    readonly from?: string;

    /**
     * Reply-to email address.
     */
    readonly replyTo?: string;
}

/**
 * Result of sending an email operation.
 */
export interface SendEmailResult {
    /**
     * Whether the email was sent successfully.
     */
    readonly success: boolean;

    /**
     * Unique message ID from Resend (on success).
     */
    readonly messageId?: string;

    /**
     * Error message (on failure).
     */
    readonly error?: string;
}

/**
 * Default sender email address for all emails.
 */
const DEFAULT_FROM = 'Hospeda <noreply@hospeda.com.ar>';

/**
 * Send an email using Resend.
 *
 * This function is non-blocking and handles errors gracefully.
 * Errors are logged to console but not thrown.
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
 *   to: 'user@example.com',
 *   subject: 'Verify your email',
 *   react: VerifyEmailTemplate({
 *     name: 'John Doe',
 *     verificationUrl: 'https://example.com/verify?token=abc123'
 *   })
 * });
 *
 * if (result.success) {
 *   console.log('Email sent:', result.messageId);
 * } else {
 *   console.error('Failed to send email:', result.error);
 * }
 * ```
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const { client, to, subject, react, from = DEFAULT_FROM, replyTo } = input;

    try {
        const { data, error } = await client.emails.send({
            from,
            to: Array.isArray(to) ? [...to] : [to],
            subject,
            react,
            ...(replyTo ? { replyTo } : {})
        });

        if (error) {
            logger.error('Failed to send:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true, messageId: data?.id };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to send:', message);
        return { success: false, error: message };
    }
}
