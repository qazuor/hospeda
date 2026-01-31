import type { ReactElement } from 'react';

/**
 * Input for sending an email
 */
export interface SendEmailInput {
    /** Recipient email address */
    to: string;
    /** Email subject line */
    subject: string;
    /** React Email component to render */
    react: ReactElement;
    /** Sender email (overrides default) */
    from?: string;
    /** Reply-to address */
    replyTo?: string;
    /** Tags for tracking/analytics */
    tags?: Array<{ name: string; value: string }>;
}

/**
 * Result from sending an email
 */
export interface SendEmailResult {
    /** Provider message ID */
    messageId: string;
}

/**
 * Abstract email transport interface for testability
 *
 * Defines the contract for email delivery implementations.
 * Allows dependency injection and easy mocking in tests.
 */
export interface EmailTransport {
    /**
     * Send an email
     *
     * @param input - Email content and metadata
     * @returns Promise resolving to send result with message ID
     * @throws {Error} If email fails to send
     */
    send(input: SendEmailInput): Promise<SendEmailResult>;
}
