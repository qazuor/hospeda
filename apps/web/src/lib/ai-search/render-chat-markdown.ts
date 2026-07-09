/**
 * @file render-chat-markdown.ts
 * @description Sanitized markdown-to-HTML converter for the AI search chat
 * bubbles (SearchChatPanel + AiChatWidget assistant messages).
 *
 * Assistant replies are model-generated and frequently contain markdown
 * emphasis (`**bold**`), lists, and inline code, but the chat bubbles render
 * `msg.content` / `currentReply` as a plain React text child — React escapes
 * the string, so the raw `**` / `-` markers show up literally instead of
 * being rendered. This helper converts the markdown into sanitized HTML that
 * can be handed to `dangerouslySetInnerHTML`.
 *
 * Pipeline: `marked` parses the markdown into HTML, then DOMPurify strips
 * anything outside a conservative allowlist — a chat bubble only ever needs
 * paragraphs, emphasis, lists, inline code/pre blocks, and links. This
 * mirrors the two-layer approach in `apps/web/src/lib/whats-new/render-markdown.ts`
 * (marked/TipTap output + DOMPurify defence-in-depth), scaled down to a
 * lighter `marked`-only parser since the chat bubbles don't need a TipTap
 * editor instance.
 *
 * SECURITY: the model output is untrusted-ish (LLM-generated, not
 * user-authored, but never assume it can't be steered into emitting HTML/
 * script-like text). Always feed the OUTPUT of this function to
 * `dangerouslySetInnerHTML`, never the raw `raw` input.
 *
 * @module render-chat-markdown
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

/** DOMPurify allowed tags for a chat bubble — conservative, chat-scoped subset. */
const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre'
] as const;

/** DOMPurify allowed attributes — only what `<a>` needs. */
const ALLOWED_ATTR = ['href', 'target', 'rel'] as const;

/** Tracks whether the anchor-hardening hook has been registered on the shared DOMPurify instance. */
let anchorHookRegistered = false;

/**
 * Registers a DOMPurify hook that forces `target="_blank"` +
 * `rel="noopener noreferrer"` on every surviving `<a>` tag, regardless of
 * what the model output. Idempotent — safe to call on every render.
 */
function ensureAnchorHookRegistered(): void {
    if (anchorHookRegistered) return;
    anchorHookRegistered = true;
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });
}

/** Escapes the four HTML-significant characters for the non-browser fallback path. */
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Argument bundle for {@link renderChatMarkdown}.
 */
export interface RenderChatMarkdownInput {
    /** Raw assistant reply text — may contain markdown emphasis, lists, links, or plain text. */
    readonly raw: string;
}

/**
 * Converts an assistant chat message into sanitized HTML safe for
 * `dangerouslySetInnerHTML`.
 *
 * Empty / non-string input yields an empty string so callers can use the
 * result inside a conditional render without an extra guard. Falls back to
 * HTML-escaped plain text if `marked` throws, or if DOMPurify is not
 * available in the current runtime (SSR / non-browser) — this module is only
 * ever invoked from mounted React islands, so that fallback path is not
 * reachable in practice, but it degrades safely rather than ever returning
 * unsanitized HTML.
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: renderChatMarkdown({ raw: msg.content }) }} />
 * ```
 */
export function renderChatMarkdown({ raw }: RenderChatMarkdownInput): string {
    if (typeof raw !== 'string' || raw.length === 0) return '';

    let html: string;
    try {
        html = marked.parse(raw, { async: false, gfm: true, breaks: true }) as string;
    } catch {
        html = `<p>${escapeHtml(raw)}</p>`;
    }

    if (typeof window === 'undefined' || !DOMPurify.isSupported) {
        return `<p>${escapeHtml(raw)}</p>`;
    }

    ensureAnchorHookRegistered();

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [...ALLOWED_TAGS],
        ALLOWED_ATTR: [...ALLOWED_ATTR],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    });
}
