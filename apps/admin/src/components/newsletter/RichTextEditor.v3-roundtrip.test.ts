/**
 * @file RichTextEditor.v3-roundtrip.test.ts
 *
 * Tiptap v3 extension-compatibility + value round-trip test for the newsletter
 * editor.
 *
 * This is the exact coverage gap that let Dependabot PR #1890 look green: no
 * test ever mounted the editor with the full extension set (StarterKit + the
 * bundled Link/Underline + Image + TextAlign), so a cross-major mismatch —
 * a v3 extension on a v2 core — produced no failure. A real, headless
 * `Editor` instance constructed with the same extensions the component uses
 * (mirrors `RichTextEditor.tsx`) both:
 *   1. fails at construction time if any extension major diverges from core, and
 *   2. lets us assert the JSON/HTML round-trip is preserved under v3.
 *
 * Kept headless (`new Editor` with no `element`) — deterministic in jsdom,
 * unlike the async ProseMirror view mount.
 */

import { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NEWSLETTER_EDITOR_EXTENSIONS } from './RichTextEditor';

/**
 * Constructs a headless editor with the component's real, exported extension
 * set — not a copy — so this test can never drift from what ships.
 */
function createNewsletterEditor(content: JSONContent | null): Editor {
    return new Editor({
        extensions: NEWSLETTER_EDITOR_EXTENSIONS,
        content: content ?? undefined
    });
}

let editor: Editor | null = null;

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('newsletter RichTextEditor — Tiptap v3 extension compatibility', () => {
    it('constructs with the full extension set without throwing (the #1890 canary)', () => {
        expect(() => {
            editor = createNewsletterEditor(null);
        }).not.toThrow();
        expect(editor).not.toBeNull();
    });

    it('exposes the bundled Link and Underline marks provided by StarterKit v3', () => {
        editor = createNewsletterEditor(null);
        const marks = editor.schema.marks;
        expect(marks.link).toBeDefined();
        expect(marks.underline).toBeDefined();
    });

    it('registers the TextAlign extension (the #1890 extension) and Image node', () => {
        editor = createNewsletterEditor(null);
        expect(editor.extensionManager.extensions.some((e) => e.name === 'textAlign')).toBe(true);
        expect(editor.schema.nodes.image).toBeDefined();
    });

    it('round-trips a document exercising heading, textAlign, underline, link and image', () => {
        const doc: JSONContent = {
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    attrs: { level: 2, textAlign: 'center' },
                    content: [{ type: 'text', text: 'Título' }]
                },
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            marks: [{ type: 'underline' }],
                            text: 'subrayado'
                        },
                        { type: 'text', text: ' y ' },
                        {
                            type: 'text',
                            marks: [{ type: 'link', attrs: { href: 'https://hospeda.com.ar' } }],
                            text: 'enlace'
                        }
                    ]
                },
                {
                    type: 'image',
                    attrs: { src: 'https://hospeda.com.ar/logo.png' }
                }
            ]
        };

        editor = createNewsletterEditor(doc);
        const html = editor.getHTML();

        expect(html).toContain('text-align: center');
        expect(html).toContain('<u>subrayado</u>');
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain('<img');
        expect(html).toContain('src="https://hospeda.com.ar/logo.png"');

        // JSON round-trip: the heading's textAlign attr survives serialization.
        const json = editor.getJSON();
        const heading = json.content?.find((n) => n.type === 'heading');
        expect(heading?.attrs?.textAlign).toBe('center');
    });

    it('preserves the bundled Link `openOnClick: false` configuration', () => {
        editor = createNewsletterEditor(null);
        const link = editor.extensionManager.extensions.find((e) => e.name === 'link');
        expect(link?.options.openOnClick).toBe(false);
    });
});
