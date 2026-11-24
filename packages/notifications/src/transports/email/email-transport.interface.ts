import type { EmailAttribution } from '@repo/email';
import type { ReactElement } from 'react';
import type { EmailCatalogKey } from '../../catalog/types.js';

/**
 * Attribution of one email (HOS-2359): `@repo/email`'s {@link EmailAttribution}
 * with the transactional `templateKey` narrowed to an email catalog key.
 */
export type NotificationEmailAttribution =
    | {
          readonly medium: 'transactional';
          readonly templateKey: EmailCatalogKey;
          readonly includePixel: boolean;
      }
    | Extract<EmailAttribution, { readonly medium: 'campaign' }>;

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
    /**
     * Who the email is attributed to: UTMs on links to our web domain and the
     * Umami open pixel (HOS-2359). Required so every sender names its catalog key.
     */
    attribution: NotificationEmailAttribution;
    /**
     * The recipient's verticals (`VerticalEnum` values), when the sender resolved them.
     * Only picks the user footer account link (HOS-2565 D16); absent falls back to
     * "Gestioná tu cuenta" and never blocks the send.
     */
    recipientVerticals?: readonly string[];
    /** Sender email (overrides default) */
    from?: string;
    /** Reply-to address */
    replyTo?: string;
    /** Tags for tracking/analytics */
    tags?: Array<{ name: string; value: string }>;
    /** File attachments for the email */
    attachments?: Array<{
        /** Filename shown to recipient */
        filename: string;
        /** File content as Buffer or base64 string */
        content: Buffer | string;
        /** MIME type (e.g., "image/png") */
        contentType?: string;
    }>;
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
