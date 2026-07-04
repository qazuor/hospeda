/**
 * @file RichTextEditor.v3-roundtrip.test.ts
 *
 * Tiptap v3 extension-compatibility + Markdown round-trip test for the web host
 * editor.
 *
 * The sibling `RichTextEditor.test.tsx` mocks `@tiptap/core` wholesale, so it
 * never exercises the real Tiptap runtime — the exact gap that let Dependabot
 * PR #1890 look green. This test constructs a real, headless `Editor` with the
 * same extensions the component mounts (mirrors `RichTextEditor.client.tsx`),
 * which fails at construction if any extension major diverges from core, and
 * asserts the Markdown value round-trips under v3.
 */

import {
    HOST_EDITOR_EXTENSIONS,
    readMarkdown
} from '@/components/host/editor/RichTextEditor.client';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Constructs a headless editor with the component's real, exported extension
 * set — not a copy — so this test can never drift from what ships.
 */
function createHostEditor(content: string): Editor {
    return new Editor({
        extensions: HOST_EDITOR_EXTENSIONS,
        content
    });
}

let editor: Editor | null = null;

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('web host RichTextEditor — Tiptap v3 extension compatibility', () => {
    it('constructs with StarterKit + Markdown without throwing (the #1890 canary)', () => {
        expect(() => {
            editor = createHostEditor('');
        }).not.toThrow();
        expect(editor).not.toBeNull();
    });

    it('exposes the bundled Link and Underline marks from StarterKit v3', () => {
        editor = createHostEditor('');
        expect(editor.schema.marks.link).toBeDefined();
        expect(editor.schema.marks.underline).toBeDefined();
    });

    it('round-trips markdown for bold, heading, list and link', () => {
        const markdown =
            '## Título\n\n**negrita** y [enlace](https://hospeda.com.ar)\n\n- uno\n- dos';
        editor = createHostEditor(markdown);

        const html = editor.getHTML();
        expect(html).toContain('<h2>Título</h2>');
        expect(html).toContain('<strong>negrita</strong>');
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain('<li>');

        const out = readMarkdown(editor);
        expect(out).toContain('## Título');
        expect(out).toContain('**negrita**');
        expect(out).toContain('[enlace](https://hospeda.com.ar)');
        expect(out).toContain('- uno');
    });

    it('honours the h2/h3 heading level restriction', () => {
        editor = createHostEditor('# H1 should degrade');
        // Level 1 is not configured, so it must not serialize as an <h1>.
        expect(editor.getHTML()).not.toContain('<h1>');
    });
});
