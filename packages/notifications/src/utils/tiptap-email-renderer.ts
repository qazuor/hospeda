import { type TiptapDocument, renderTiptapContent } from '@repo/utils';
import sanitizeHtml from 'sanitize-html';

/**
 * Inline styles applied to base HTML elements when rendering a TipTap
 * document for email delivery. The shared base renderer in `@repo/utils`
 * produces semantic HTML; this transformer post-processes it to make the
 * markup safe and visually consistent across email clients (which do not
 * reliably honour external stylesheets or many CSS features).
 */
const EMAIL_INLINE_STYLES: ReadonlyArray<readonly [RegExp, string]> = [
    [/<p(\s|>)/g, '<p style="color:#1e293b;font-size:16px;line-height:24px;margin:0 0 16px"$1'],
    [
        /<h1(\s|>)/g,
        '<h1 style="color:#0f172a;font-size:28px;line-height:36px;font-weight:700;margin:24px 0 12px"$1'
    ],
    [
        /<h2(\s|>)/g,
        '<h2 style="color:#0f172a;font-size:22px;line-height:30px;font-weight:700;margin:20px 0 10px"$1'
    ],
    [
        /<h3(\s|>)/g,
        '<h3 style="color:#0f172a;font-size:18px;line-height:26px;font-weight:600;margin:16px 0 8px"$1'
    ],
    [
        /<h4(\s|>)/g,
        '<h4 style="color:#0f172a;font-size:16px;line-height:24px;font-weight:600;margin:14px 0 6px"$1'
    ],
    [
        /<img(\s|>)/g,
        '<img style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;margin:16px auto"$1'
    ],
    [
        /<ul(\s|>)/g,
        '<ul style="color:#1e293b;font-size:16px;line-height:24px;margin:0 0 16px;padding-left:24px"$1'
    ],
    [
        /<ol(\s|>)/g,
        '<ol style="color:#1e293b;font-size:16px;line-height:24px;margin:0 0 16px;padding-left:24px"$1'
    ],
    [/<li(\s|>)/g, '<li style="margin:0 0 6px"$1'],
    [
        /<blockquote(\s|>)/g,
        '<blockquote style="border-left:3px solid #e2e8f0;margin:16px 0;padding:8px 16px;color:#475569;font-style:italic"$1'
    ],
    [
        /<pre(\s|>)/g,
        '<pre style="background-color:#f8fafc;border-radius:6px;padding:12px 16px;margin:16px 0;overflow:auto;font-family:Menlo,Consolas,monospace;font-size:14px"$1'
    ],
    [
        /<code(\s|>)/g,
        '<code style="background-color:#f1f5f9;border-radius:4px;padding:1px 4px;font-family:Menlo,Consolas,monospace;font-size:14px"$1'
    ],
    [/<a(\s|>)/g, '<a style="color:#3b82f6;text-decoration:underline"$1'],
    [/<hr(\s|\/?>)/g, '<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"$1']
];

/**
 * Tags allowed in an email body. This is the complete set the base TipTap
 * renderer can emit (headings, lists, inline formatting, links, images) plus
 * a couple of harmless structural tags. Anything outside this allowlist
 * (`script`, `style`, `iframe`, `object`, `form`, ...) is discarded.
 */
const EMAIL_ALLOWED_TAGS: readonly string[] = [
    'p',
    'br',
    'hr',
    'blockquote',
    'pre',
    'code',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'u',
    's',
    'a',
    'img'
];

/**
 * Attributes allowed per tag. Every attribute not listed here is dropped,
 * which removes ALL inline event handlers (`onclick`, `onerror`, ...) and any
 * `style`/`srcset`/etc. The renderer emits `target`/`rel` on links, so we keep
 * them.
 */
const EMAIL_ALLOWED_ATTRIBUTES: { readonly a: readonly string[]; readonly img: readonly string[] } =
    {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt']
    };

/**
 * URL schemes permitted in `href`/`src`. Excludes `javascript:`, `data:`, and
 * `vbscript:`, which are the classic email/webmail XSS vectors. The base
 * renderer escapes href text but does NOT scheme-check it, so this is the
 * layer that actually neutralises a `javascript:` link coming from a TipTap
 * document.
 */
const EMAIL_ALLOWED_SCHEMES: readonly string[] = ['http', 'https', 'mailto'];

/**
 * Sanitises an HTML fragment for safe inclusion in an email body.
 *
 * Uses the `sanitize-html` parser with a strict allowlist instead of a regex
 * blacklist. A parser cannot be defeated by the malformed-tag, unquoted
 * attribute, or nested-tag tricks that bypass regex strippers, and it has no
 * catastrophic-backtracking surface.
 *
 * @param html - HTML produced by the base TipTap renderer (or arbitrary input)
 * @returns HTML containing only allowlisted tags, attributes, and URL schemes
 */
export function sanitizeEmailHtml(html: string): string {
    if (!html) {
        return '';
    }
    return sanitizeHtml(html, {
        allowedTags: [...EMAIL_ALLOWED_TAGS],
        allowedAttributes: {
            a: [...EMAIL_ALLOWED_ATTRIBUTES.a],
            img: [...EMAIL_ALLOWED_ATTRIBUTES.img]
        },
        allowedSchemes: [...EMAIL_ALLOWED_SCHEMES],
        // Images must load over the network; never allow `data:` image URIs.
        allowedSchemesByTag: { img: ['http', 'https'] },
        disallowedTagsMode: 'discard'
    });
}

/**
 * Applies inline styles to known semantic elements emitted by the base renderer.
 *
 * Each replacement is anchored on the opening tag and preserves any existing
 * attributes by capturing the next character (`\s` or `>`). Self-closing tags
 * such as `<hr />` and `<img ... />` are matched on their attribute boundary so
 * we never duplicate styles or break the close tag.
 *
 * @param html - HTML produced by the base TipTap renderer
 * @returns HTML with email-safe inline styles applied
 */
function applyInlineStyles(html: string): string {
    return EMAIL_INLINE_STYLES.reduce((acc, [pattern, replacement]) => {
        return acc.replace(pattern, replacement);
    }, html);
}

/**
 * Renders a TipTap document to HTML suitable for embedding inside an email
 * template.
 *
 * Pipeline:
 *  1. Delegate the JSON → HTML conversion to `renderTiptapContent` in
 *     `@repo/utils` (single source of truth for the base output).
 *  2. Sanitise the HTML through `sanitize-html` with a strict allowlist
 *     (`sanitizeEmailHtml`). This discards unsafe tags, every inline event
 *     handler, and any non-http(s)/mailto URL scheme — including a
 *     `javascript:` link the base renderer would otherwise emit verbatim.
 *  3. Apply inline styles to known semantic elements so the markup renders
 *     consistently in email clients that ignore external CSS.
 *
 * Sanitisation runs BEFORE styling so the parser never strips the inline
 * `style` attributes added in step 3.
 *
 * The returned HTML is meant to be passed as `bodyHtml` to the
 * `NewsletterCampaign` template wrapper, which itself injects it verbatim
 * inside the email body.
 *
 * @param params - Parameters object
 * @param params.content - TipTap document to render
 * @returns Sanitised, email-styled HTML string (empty string for null input)
 *
 * @example
 * ```typescript
 * const html = renderTiptapEmailContent({ content: doc });
 * // <p style="color:#1e293b;font-size:16px;...">Hola</p>
 * ```
 */
export function renderTiptapEmailContent({
    content
}: {
    content: TiptapDocument | null | undefined;
}): string {
    const baseHtml = renderTiptapContent({ content });
    if (baseHtml === '') {
        return '';
    }
    const sanitized = sanitizeEmailHtml(baseHtml);
    return applyInlineStyles(sanitized);
}
