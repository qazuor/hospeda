/**
 * Mailer of the admin direct emails (HOS-2685): renders the `DirectEmail` template
 * around the sanitised TipTap body and sends one message through Brevo.
 *
 * The preview and the real send render the same element with the same attribution and
 * layout, so the preview shows exactly what the recipient gets.
 *
 * @module services/direct-email/direct-email-mailer
 */

import { createEmailClient, renderEmailBodies } from '@repo/email';
import { DirectEmail, renderTiptapEmailContent } from '@repo/notifications';
import type { DirectEmailMailerPort, DirectEmailRenderInput } from '@repo/service-core';
import {
    buildAppEmailLayout,
    buildTransactionalAttribution,
    DIRECT_EMAIL_KEYS
} from '../../utils/email-attribution';
import { sendDirectAppEmail } from '../../utils/email-sender';
import { env } from '../../utils/env';

/** Builds the template element of one message. */
function buildElement(input: DirectEmailRenderInput) {
    return DirectEmail({
        subject: input.subject,
        // renderTiptapEmailContent sanitises the document (allowlist, no raw HTML or javascript: links).
        bodyHtml: renderTiptapEmailContent({ content: input.bodyJson as never }),
        optOutUrl: input.optOutUrl,
        isTest: input.isTest
    });
}

/**
 * Creates the production mailer.
 *
 * @param deps.apiKey - Brevo API key; defaults to `HOSPEDA_EMAIL_API_KEY`. Without it
 *   sends fail with an explicit error (previews still render).
 * @returns The mailer port the direct email message service takes
 */
export function createDirectEmailMailer(
    deps: { readonly apiKey?: string | undefined } = {}
): DirectEmailMailerPort {
    const apiKey = deps.apiKey ?? env.HOSPEDA_EMAIL_API_KEY;
    const templateKey = DIRECT_EMAIL_KEYS.message;

    return {
        async renderHtml(input) {
            const { html } = await renderEmailBodies({
                react: buildElement(input),
                attribution: buildTransactionalAttribution({ templateKey }),
                layout: buildAppEmailLayout({ templateKey })
            });
            return html;
        },

        async send(input) {
            if (!apiKey) {
                return { success: false, error: 'HOSPEDA_EMAIL_API_KEY is not configured' };
            }
            const result = await sendDirectAppEmail({
                client: createEmailClient({ apiKey }),
                to: input.to,
                subject: input.subject,
                react: buildElement(input),
                attribution: buildTransactionalAttribution({ templateKey }),
                layout: buildAppEmailLayout({ templateKey }),
                fromEmail: input.fromEmail,
                fromName: input.fromName,
                replyTo: input.replyTo
            });
            return {
                success: result.success,
                ...(result.messageId ? { messageId: result.messageId } : {}),
                ...(result.error ? { error: result.error } : {})
            };
        }
    };
}
