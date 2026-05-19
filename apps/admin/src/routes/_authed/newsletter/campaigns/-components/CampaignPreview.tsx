/**
 * @file CampaignPreview.tsx
 * @description Read-only email preview pane for the newsletter campaign editor.
 *
 * Renders the TipTap-generated HTML inside a card that mimics an email-client
 * preview at ~600 px width. The rendered HTML comes from `renderTiptapContent`
 * (controlled escaping via `@repo/utils`); a defense-in-depth pass through
 * DOMPurify before injection satisfies the Semgrep audit rule and protects
 * against future regressions of the upstream renderer.
 *
 * @module CampaignPreview
 */

import DOMPurify from 'dompurify';
import type { ReactNode } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Props for the CampaignPreview component.
 */
export interface CampaignPreviewProps {
    /** Rendered HTML string produced by `renderTiptapContent`. May be empty. */
    readonly html: string;
    /** Email subject displayed as the visible H1 inside the preview. */
    readonly subject: string;
}

// ─── Email chrome wrapper ─────────────────────────────────────────────────────

interface EmailChromeProps {
    readonly children: ReactNode;
}

function EmailChrome({ children }: EmailChromeProps) {
    return (
        <section
            className="w-full max-w-[600px] overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            aria-label="Vista previa del email"
        >
            {/* Simulated email header bar */}
            <div className="flex items-center gap-2 border-border border-b bg-muted/40 px-4 py-2.5">
                <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/70" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                    <span className="h-3 w-3 rounded-full bg-green-400/70" />
                </div>
                <span className="ml-2 font-medium text-muted-foreground text-xs">
                    Hospeda — hospeda.com.ar
                </span>
            </div>

            {/* Email body */}
            <div className="p-6">{children}</div>

            {/* Simulated footer */}
            <div className="border-border border-t bg-muted/20 px-6 py-3 text-center text-muted-foreground text-xs">
                © Hospeda · Concepción del Uruguay, Entre Ríos, Argentina ·{' '}
                <span className="underline">Cancelar suscripción</span>
            </div>
        </section>
    );
}

// ─── CampaignPreview ──────────────────────────────────────────────────────────

/**
 * Live preview pane for a newsletter campaign.
 *
 * Displays subject as the email H1 heading, then renders the HTML body
 * produced by `renderTiptapContent`. The inner HTML content is safe
 * because the HTML is the controlled output of `renderTiptapContent` from
 * `@repo/utils`, which HTML-escapes all text content and only produces
 * a trusted, whitelist-driven HTML structure.
 *
 * @param props - CampaignPreviewProps
 *
 * @example
 * ```tsx
 * <CampaignPreview html={renderedHtml} subject="Novedades de mayo" />
 * ```
 */
export function CampaignPreview({ html, subject }: CampaignPreviewProps) {
    const isEmpty = !html.trim();

    return (
        <div className="flex flex-col gap-3">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Vista previa
            </p>

            <EmailChrome>
                {/* Subject rendered as the visible inbox H1 */}
                {subject ? (
                    <h1 className="mb-4 font-bold text-foreground text-xl leading-snug">
                        {subject}
                    </h1>
                ) : (
                    <h1 className="mb-4 font-bold text-muted-foreground/80 text-xl italic leading-snug">
                        (sin asunto)
                    </h1>
                )}

                {isEmpty ? (
                    <p className="text-center text-muted-foreground/80 text-sm italic">
                        El contenido del email aparecerá aquí...
                    </p>
                ) : (
                    <RichHtmlContent html={html} />
                )}
            </EmailChrome>
        </div>
    );
}

// ─── Safe HTML renderer ───────────────────────────────────────────────────────

interface RichHtmlContentProps {
    readonly html: string;
}

/**
 * Renders pre-sanitized HTML from renderTiptapContent.
 * The content is trusted because it comes exclusively from the controlled
 * renderTiptapContent function in @repo/utils, which applies strict
 * HTML escaping and only emits a whitelist of known-safe tags.
 */
function RichHtmlContent({ html }: RichHtmlContentProps) {
    const sanitized = DOMPurify.sanitize(html);
    return (
        <div
            className="prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_a]:underline"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify above (defense-in-depth on top of renderTiptapContent's whitelist escaping)
            dangerouslySetInnerHTML={{ __html: sanitized }}
        />
    );
}
