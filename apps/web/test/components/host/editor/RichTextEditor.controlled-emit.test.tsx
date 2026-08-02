/**
 * @file RichTextEditor.controlled-emit.test.tsx
 * @description Regression guard (HOS-371): the editor must never report a
 * change it did not receive.
 *
 * Deliberately runs against the REAL TipTap, unlike `RichTextEditor.test.tsx`
 * which mocks `useEditor` wholesale — the bug lives in TipTap's own emit
 * behaviour, so a mocked editor cannot reproduce it.
 *
 * The stored values below are NOT decorative. `setEditable`'s default emit
 * carried TipTap's NORMALIZED serialization, so the defect only showed for
 * content that is not already in TipTap's canonical form. A single-line string
 * like `"old text"` round-trips byte-identical and passes even with the bug
 * present — the first cut of this guard used only such strings and reported
 * the fix as complete while every realistic stored value still broke. Every
 * shape in `NON_CANONICAL_VALUES` was verified to FAIL before the fix.
 */

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';

/** Waits for the deferred (`immediatelyRender: false`) editor to finish init. */
async function waitForEditorMount(): Promise<void> {
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    // The mount-time update transaction lands after the view is in the DOM.
    await new Promise((resolve) => setTimeout(resolve, 50));
}

/** The subset of the TipTap editor this test drives. */
interface EditableElement extends HTMLElement {
    readonly editor: { readonly commands: { insertContent: (content: string) => boolean } };
}

/**
 * Returns TipTap's editable element together with the editor instance TipTap
 * attaches to it, failing loudly if either is missing — a silent `undefined`
 * here would turn the "real edit still emits" assertion into a no-op.
 */
function getEditable(): EditableElement {
    const el = document.querySelector('.ProseMirror') as EditableElement | null;
    expect(el).toBeTruthy();
    expect(el?.editor?.commands?.insertContent).toBeTypeOf('function');
    return el as EditableElement;
}

/**
 * Stored Markdown shapes that TipTap does NOT serialize back byte-identically.
 * Each one reproduced the defect before the fix; a single-line string does not.
 */
const NON_CANONICAL_VALUES: Readonly<Record<string, string>> = {
    'a trailing newline (stripped on serialize)': 'trailing newline test\n',
    'single newlines (collapsed into spaces)': 'line one\nline two',
    'runs of blank lines (collapsed to one)': 'multiple\n\n\n\nblank lines',
    'trailing whitespace (trimmed)': 'texto con espacio final ',
    'a list with a trailing newline': '- uno\n- dos\n',
    'well-formed Markdown with a trailing newline': '## T\n\nUn parrafo.\n\n- a\n- b\n'
};

describe('RichTextEditor — controlled emit contract', () => {
    describe.each(Object.entries(NON_CANONICAL_VALUES))('stored value with %s', (_label, value) => {
        it('does not fire onChange on mount', async () => {
            // Arrange
            const onChange = vi.fn();

            // Act
            render(
                <RichTextEditor
                    value={value}
                    onChange={onChange}
                />
            );
            await waitForEditorMount();

            // Assert — before the fix, `setEditable`'s default emit fired
            // here with TipTap's normalized serialization, which differs
            // from this stored string, so the equality guard let it through
            // and the field went dirty on load.
            expect(onChange).not.toHaveBeenCalled();
        });

        it('still fires onChange for a real edit', async () => {
            // Arrange
            const onChange = vi.fn();
            render(
                <RichTextEditor
                    value={value}
                    onChange={onChange}
                />
            );
            await waitForEditorMount();

            // Act
            getEditable().editor.commands.insertContent(' AGREGADO');

            // Assert — the guards must suppress only non-edits.
            await waitFor(() => expect(onChange).toHaveBeenCalled());
            expect(onChange.mock.calls.at(-1)?.[0]).toContain('AGREGADO');
        });
    });

    it('syncs an external value change into the editor without reporting it as an edit', async () => {
        // Arrange — the accommodation editor's AiTextImprovePanel writes an
        // accepted suggestion straight to the parent's field, so this sync path
        // is load-bearing and must not be "fixed" by removing it.
        const onChange = vi.fn();
        const { rerender } = render(
            <RichTextEditor
                value={'line one\nline two'}
                onChange={onChange}
            />
        );
        await waitForEditorMount();

        // Act
        rerender(
            <RichTextEditor
                value="contenido totalmente distinto"
                onChange={onChange}
            />
        );
        await waitFor(() =>
            expect(getEditable().textContent).toBe('contenido totalmente distinto')
        );

        // Assert — the editor shows the new value, and the parent was never
        // told the user changed anything.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('applies a disabled toggle without reporting it as an edit', async () => {
        // Arrange — `setEditable` is what emitted the phantom edit; assert the
        // fix kept the flag working rather than just silencing the call.
        const onChange = vi.fn();
        const { rerender } = render(
            <RichTextEditor
                value={'line one\nline two'}
                onChange={onChange}
                disabled={false}
            />
        );
        await waitForEditorMount();
        expect(getEditable().getAttribute('contenteditable')).toBe('true');

        // Act
        rerender(
            <RichTextEditor
                value={'line one\nline two'}
                onChange={onChange}
                disabled={true}
            />
        );
        await waitFor(() => expect(getEditable().getAttribute('contenteditable')).toBe('false'));

        // Assert
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not fire onChange on mount when seeded with an existing value', async () => {
        // Arrange
        const onChange = vi.fn();

        // Act
        render(
            <RichTextEditor
                value="old text"
                onChange={onChange}
            />
        );
        await waitForEditorMount();

        // Assert — TipTap emits an update when it first parses `content`. Before
        // the fix this surfaced as onChange('old text'): identical content, but
        // enough to mark the field dirty in any parent that dirty-tracks per
        // field (CommerceListingEditor), enabling Save with zero user edits.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not fire onChange on mount when seeded empty', async () => {
        // Arrange
        const onChange = vi.fn();

        // Act
        render(
            <RichTextEditor
                value=""
                onChange={onChange}
            />
        );
        await waitForEditorMount();

        // Assert — the empty case emitted onChange('') before the fix, which is
        // the same false-dirty signal for a listing that has no rich text yet.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('still fires onChange when the document actually changes', async () => {
        // Arrange
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value="old text"
                onChange={onChange}
            />
        );
        await waitForEditorMount();

        // Act — drive a REAL ProseMirror transaction. Neither
        // `document.execCommand` (absent in jsdom) nor synthetic key events
        // reach ProseMirror here, and a test that silently no-ops would assert
        // nothing while still passing. TipTap hangs the editor instance off its
        // own editable element, which is the only handle available from
        // outside; narrow it rather than reaching for `any`.
        const editable = getEditable();
        editable.editor.commands.insertContent(' plus more');

        // Assert — the guard must suppress ONLY no-op emits. A genuine edit
        // still has to reach the parent, otherwise the fix would have traded a
        // false-dirty bug for a silently-unsaveable field.
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange.mock.calls.at(-1)?.[0]).toContain('plus more');
    });
});
