/**
 * @module direct-email.ports
 *
 * Ports of the direct email message service (HOS-2685). The service never imports the
 * email transport or the template package: the host app injects them, so unit tests
 * send nothing.
 */

import type { TiptapDocument } from '@repo/schemas';

/** What the mailer needs to render the final HTML of one email. */
export interface DirectEmailRenderInput {
    /** Subject as the recipient will read it (already prefixed `[PRUEBA]` for a test). */
    readonly subject: string;
    /** TipTap document. The mailer sanitises it. */
    readonly bodyJson: TiptapDocument;
    /** Opt-out URL of the recipient. */
    readonly optOutUrl: string;
    /** `true` adds the test banner. */
    readonly isTest: boolean;
}

/** What the mailer needs to send one email to one recipient. */
export interface DirectEmailMailInput extends DirectEmailRenderInput {
    readonly to: string;
    /** From address (already resolved: the direct email sender or the fallback). */
    readonly fromEmail: string;
    /** From display name, before any environment marker: `<admin first name> de Hospeda`. */
    readonly fromName: string;
    /** Reply-To: the sending admin's own address. */
    readonly replyTo: string;
}

/** Provider outcome of one send. Never throws: failures come back as `success: false`. */
export interface DirectEmailMailOutcome {
    readonly success: boolean;
    /** Provider message id on success. */
    readonly messageId?: string;
    /** Provider error on failure. */
    readonly error?: string;
}

/** Renders and sends direct emails. In production: the Brevo sender of `apps/api`. */
export interface DirectEmailMailerPort {
    /**
     * Renders the exact HTML a recipient would get.
     *
     * @param input - Subject, body, opt-out URL and test flag
     * @returns The full HTML document
     */
    renderHtml(input: DirectEmailRenderInput): Promise<string>;

    /**
     * Sends one message to one recipient.
     *
     * @param input - Recipient, sender, subject and body
     * @returns The provider outcome
     */
    send(input: DirectEmailMailInput): Promise<DirectEmailMailOutcome>;
}
