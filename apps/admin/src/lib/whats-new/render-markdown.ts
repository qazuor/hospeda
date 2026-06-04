/**
 * renderMarkdownToHtml — sanitised markdown-to-HTML converter for What's New.
 *
 * Uses a headless TipTap `Editor` instance (no DOM mount) plus DOMPurify as a
 * defence-in-depth sanitisation pass (AC-13).
 *
 * ## Security (AC-13)
 *
 * Two layers:
 *  1. TipTap StarterKit schema allowlist — ProseMirror serialisation never emits
 *     `<script>`, `<iframe>`, or `on*` event handler attributes.
 *  2. DOMPurify — explicit `ALLOWED_TAGS` / `FORBID_TAGS` allowlist.
 *
 * The source markdown originates from the curated `whats-new.ts` data file (not
 * user-supplied), but we sanitise defensively regardless.
 *
 * ## Rendering approach
 *
 * `new Editor({ content: markdownString, extensions: [StarterKit, Markdown] })`
 * then `editor.getHTML()`. The Markdown extension parses the markdown string into
 * a ProseMirror document; `getHTML()` serialises it using TipTap's HTML
 * serialiser. The editor is never mounted in the DOM and is destroyed immediately
 * after `getHTML()` is called, so there is no DOM overhead.
 *
 * Isolated in its own module so tests can mock it without pulling the TipTap
 * runtime. `Editor` is imported from `@tiptap/react` (a declared dependency that
 * re-exports it from `@tiptap/core`) so typecheck never depends on a transitive
 * package.
 *
 * @module render-markdown
 * @see apps/admin/src/components/whats-new/WhatsNewModal.tsx — consumer
 * @see SPEC-175 §7.2, §12, AC-13
 */

import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { Markdown } from 'tiptap-markdown';

/** DOMPurify allowed tags for rendered markdown (AC-13). */
const DOMPURIFY_ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'del',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'a',
    'hr'
] as const;

/** DOMPurify allowed attributes (AC-13). */
const DOMPURIFY_ALLOWED_ATTR = ['href', 'target', 'rel'] as const;

/**
 * Converts a markdown string to sanitised HTML.
 *
 * Uses a headless TipTap `Editor` + `getHTML()` + DOMPurify.
 * The editor is created, queried, and destroyed in a single synchronous call.
 *
 * @param markdown - Raw markdown body string from a `WhatsNewItem`.
 * @returns Sanitised HTML string. Falls back to escaped plain text on error.
 */
export function renderMarkdownToHtml(markdown: string): string {
    let html = '';
    let editor: Editor | null = null;

    try {
        editor = new Editor({
            extensions: [StarterKit, Markdown],
            content: markdown
        });

        html = editor.getHTML();
    } catch {
        // Fallback: escape raw text into a paragraph.
        html = `<p>${markdown
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</p>`;
    } finally {
        editor?.destroy();
    }

    // Defence-in-depth DOMPurify pass.
    // In non-browser environments (SSR/test without window) DOMPurify is a
    // no-op — TipTap's allowlist has already handled the content.
    if (typeof window !== 'undefined' && DOMPurify.isSupported) {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [...DOMPURIFY_ALLOWED_TAGS],
            ALLOWED_ATTR: [...DOMPURIFY_ALLOWED_ATTR],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
        });
    }

    return html;
}
