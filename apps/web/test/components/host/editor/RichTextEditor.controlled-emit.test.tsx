/**
 * @file RichTextEditor.controlled-emit.test.tsx
 * @description Regression guard (HOS-371): the editor must never report a
 * change it did not receive.
 *
 * Deliberately runs against the REAL TipTap, unlike `RichTextEditor.test.tsx`
 * which mocks `useEditor` wholesale — the bug lives entirely inside TipTap's
 * own mount-time update transaction, so a mocked editor cannot reproduce it.
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

describe('RichTextEditor — controlled emit contract', () => {
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
