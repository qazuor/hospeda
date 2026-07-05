/**
 * @file RichTextField.v3-roundtrip.test.ts
 *
 * Tiptap v3 extension-compatibility + Markdown round-trip test for the
 * entity-form RichTextField editor.
 *
 * Constructs a real, headless `Editor` with the same extensions the component
 * mounts (mirrors `RichTextField.tsx`), which fails at construction if any
 * extension major diverges from core — the failure mode Dependabot PR #1890
 * could not surface — and asserts the Markdown value round-trips under v3,
 * including the bundled Link's preserved `HTMLAttributes.class`.
 */

import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RICH_TEXT_FIELD_EXTENSIONS, readMarkdown } from './RichTextField';

/** Expected Link class the component configures (asserted in rendered output). */
const LINK_CLASS = 'text-primary underline underline-offset-2 hover:no-underline';

/**
 * Constructs a headless editor with the component's real, exported extension
 * set — not a copy — so this test can never drift from what ships.
 */
function createFieldEditor(content: string): Editor {
    return new Editor({
        extensions: RICH_TEXT_FIELD_EXTENSIONS,
        content
    });
}

let editor: Editor | null = null;

afterEach(() => {
    editor?.destroy();
    editor = null;
});

describe('RichTextField — Tiptap v3 extension compatibility', () => {
    it('constructs with StarterKit + Markdown without throwing (the #1890 canary)', () => {
        expect(() => {
            editor = createFieldEditor('');
        }).not.toThrow();
        expect(editor).not.toBeNull();
    });

    it('exposes the bundled Link and Underline marks from StarterKit v3', () => {
        editor = createFieldEditor('');
        expect(editor.schema.marks.link).toBeDefined();
        expect(editor.schema.marks.underline).toBeDefined();
    });

    it('round-trips markdown for bold, heading, list and link', () => {
        const markdown =
            '## Título\n\n**negrita** y [enlace](https://hospeda.com.ar)\n\n- uno\n- dos';
        editor = createFieldEditor(markdown);

        const out = readMarkdown(editor);
        expect(out).toContain('## Título');
        expect(out).toContain('**negrita**');
        expect(out).toContain('[enlace](https://hospeda.com.ar)');
        expect(out).toContain('- uno');
    });

    it('applies the configured Link HTMLAttributes.class to rendered anchors', () => {
        editor = createFieldEditor('[enlace](https://hospeda.com.ar)');
        const html = editor.getHTML();
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain(`class="${LINK_CLASS}"`);
    });

    it('honours the h2/h3 heading level restriction', () => {
        editor = createFieldEditor('# H1 should degrade');
        expect(editor.getHTML()).not.toContain('<h1>');
    });
});
