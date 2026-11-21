/**
 * @file render-help-markdown.ts
 * @description Turns one section of a help article (Markdown whose tokens are
 * already resolved, see `help-tokens.ts`) into sanitized HTML (HOS-2410
 * `docs/web-ui.md` §4).
 *
 * The same pipeline as `render-content.ts` (`marked`, then `sanitizeHtml`),
 * with one addition: every `###` gets the stable anchor id the generator
 * checked (`helpSubHeading` from `@repo/help`), so an
 * `{{article:<id>:<anchor>}}` link lands on its heading, and an explicit
 * `{#id}` never shows as text.
 *
 * SECURITY: feed only the OUTPUT of this function to `set:html`.
 */

import { helpSubHeading } from '@repo/help';
import { Marked, type Tokens } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize-html';

/** A `marked` instance whose `###` headings carry their help anchor id. */
const helpMarked: Marked = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
        heading({ text, depth }: Tokens.Heading): string | false {
            if (depth !== 3) {
                return false;
            }
            const heading = helpSubHeading({ text });
            const inner = helpMarked.parseInline(heading.text, { async: false }) as string;
            return `<h3 id="${heading.anchor}">${inner}</h3>\n`;
        }
    }
});

/** Arguments for {@link renderHelpMarkdown}. RO-RO. */
export interface RenderHelpMarkdownArgs {
    /** Markdown with its tokens already resolved. */
    readonly markdown: string;
    /** Site origin, forwarded to `sanitizeHtml` for absolute-URL handling. */
    readonly siteOrigin: string;
}

/**
 * Renders a help section to safe HTML.
 *
 * @param args - The Markdown and the site origin
 * @returns Sanitized HTML, empty for empty input
 *
 * @example
 * ```ts
 * renderHelpMarkdown({ markdown: '### No se ven {#no-se-ven}\nTexto.', siteOrigin });
 * // '<h3 id="no-se-ven">No se ven</h3>\n<p>Texto.</p>\n'
 * ```
 */
export function renderHelpMarkdown({ markdown, siteOrigin }: RenderHelpMarkdownArgs): string {
    if (markdown.trim() === '') {
        return '';
    }
    const html = helpMarked.parse(markdown, { async: false }) as string;
    return sanitizeHtml({ html, siteOrigin });
}
