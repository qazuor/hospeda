import { render } from '@react-email/render';
import { createElement, type ReactElement } from 'react';
import { applyEmailAttribution, type EmailAttribution } from './attribution.js';
import {
    EmailLayoutContext,
    type EmailLayoutContextValue
} from './templates/email-layout-context.js';

/**
 * Input of {@link renderEmailBodies}.
 */
export interface RenderEmailBodiesInput {
    /** React Email element to serialize. */
    readonly react: ReactElement;
    /**
     * Who the email is attributed to (HOS-2359). Required on purpose: every caller
     * must decide which template or campaign it is, and whether it counts an open.
     */
    readonly attribution: EmailAttribution;
    /**
     * Per-send data for the user layout (HOS-2565 PR-4): the declared illustration and
     * help articles, and the recipient's verticals. Omitted: an empty context.
     */
    readonly layout?: EmailLayoutContextValue;
}

/**
 * The two bodies of one email, exactly as the provider receives them.
 */
export interface RenderedEmailBodies {
    /** Full HTML document (`htmlContent`). */
    readonly html: string;
    /** text/plain alternative rendered from the same element (`textContent`). */
    readonly text: string;
}

/**
 * Renders one React Email element into the HTML body and the text/plain
 * alternative that every Hospeda send path posts to the provider.
 *
 * HTML-only mail is flagged by spam filters (MIME_HTML_ONLY) and is unreadable
 * in text clients, so both transports send a plain part rendered from the same
 * element (HOS-1990, HOS-2107). This is the single place that pairing lives:
 * `sendEmail`, the notifications transport and the admin email preview all
 * call it, so a preview shows the bytes an inbox receives (HOS-2519 D4).
 *
 * Attribution (UTMs on links to our web domain) is applied here through
 * {@link applyEmailAttribution} (HOS-2359). There is no open pixel (HOS-2583).
 *
 * @param input - The element to render.
 * @returns The HTML and plain-text bodies.
 *
 * @example
 * ```ts
 * const { html, text } = await renderEmailBodies({
 *     react: VerifyEmailTemplate({ name, verificationUrl }),
 *     attribution: { medium: 'transactional', templateKey: 'auth.verify-email' }
 * });
 * ```
 */
export async function renderEmailBodies(
    input: RenderEmailBodiesInput
): Promise<RenderedEmailBodies> {
    const element = input.layout
        ? createElement(EmailLayoutContext.Provider, { value: input.layout }, input.react)
        : input.react;
    const rawHtml = await render(element);
    const rawText = await render(element, { plainText: true });
    const { html, text = rawText } = applyEmailAttribution({
        html: rawHtml,
        text: rawText,
        attribution: input.attribution
    });
    return { html, text };
}
