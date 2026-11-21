import { render } from '@react-email/render';
import type { ReactElement } from 'react';

/**
 * Input of {@link renderEmailBodies}.
 */
export interface RenderEmailBodiesInput {
    /** React Email element to serialize. */
    readonly react: ReactElement;
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
 * @param input - The element to render.
 * @returns The HTML and plain-text bodies.
 *
 * @example
 * ```ts
 * const { html, text } = await renderEmailBodies({
 *     react: VerifyEmailTemplate({ name, verificationUrl })
 * });
 * ```
 */
export async function renderEmailBodies(
    input: RenderEmailBodiesInput
): Promise<RenderedEmailBodies> {
    const html = await render(input.react);
    const text = await render(input.react, { plainText: true });
    return { html, text };
}
