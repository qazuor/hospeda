/**
 * @file RichTextEditor.link-dialog.test.tsx
 * @description HOS-957 — the toolbar's link button opens `LinkUrlDialog`
 * instead of raising `window.prompt('URL del enlace', previous)`.
 *
 * Runs against the REAL TipTap (like `RichTextEditor.controlled-emit.test.tsx`,
 * and unlike `RichTextEditor.test.tsx` which mocks `useEditor` wholesale),
 * because what has to keep working is the three-way contract the prompt had and
 * the editor commands on the other side of it:
 *
 *  - a URL sets the link on the selection;
 *  - an EMPTY submit REMOVES it — the only way to unlink, and the arm most
 *    likely to be collapsed into a cancel by someone tidying the code;
 *  - cancel leaves the document untouched.
 *
 * A mocked editor would assert that a callback fired, not that the link landed.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';

/** The subset of the TipTap editor this test drives. */
interface EditableElement extends HTMLElement {
    readonly editor: { readonly commands: { selectAll: () => boolean } };
}

/** Waits for the deferred (`immediatelyRender: false`) editor to finish init. */
async function waitForEditorMount(): Promise<EditableElement> {
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
    const el = document.querySelector('.ProseMirror') as EditableElement | null;
    // A silent `undefined` here would turn every assertion below into a no-op.
    expect(el?.editor?.commands?.selectAll).toBeTypeOf('function');
    return el as EditableElement;
}

/** Opens the link dialog over the whole document. */
async function openLinkDialogOverAll(): Promise<void> {
    const editable = await waitForEditorMount();
    editable.editor.commands.selectAll();
    fireEvent.click(screen.getByRole('button', { name: 'Enlace' }));
}

const field = (): HTMLInputElement => screen.getByLabelText(/URL del enlace/);

describe('RichTextEditor — link dialog (HOS-957)', () => {
    it('opens the dialog instead of a native prompt, and applies the URL', async () => {
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value="texto"
                onChange={onChange}
                locale="es"
            />
        );

        await openLinkDialogOverAll();

        expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
        fireEvent.change(field(), { target: { value: 'https://example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
        });
        const emitted = onChange.mock.calls.map(([md]) => md as string);
        expect(emitted.at(-1)).toContain('https://example.com');
    });

    it('removes the link when the field is submitted EMPTY', async () => {
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value="[texto](https://example.com)"
                onChange={onChange}
                locale="es"
            />
        );

        await openLinkDialogOverAll();

        // The dialog arrives pre-filled with the selection's current href, the
        // way the prompt's second argument did.
        expect(field().value).toBe('https://example.com');

        fireEvent.change(field(), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
        });
        const emitted = onChange.mock.calls.map(([md]) => md as string);
        expect(emitted.at(-1)).not.toContain('https://example.com');
        expect(emitted.at(-1)).toContain('texto');
    });

    it('leaves the document untouched on cancel', async () => {
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value="[texto](https://example.com)"
                onChange={onChange}
                locale="es"
            />
        );

        await openLinkDialogOverAll();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Aplicar' })).not.toBeInTheDocument();
        });
        expect(onChange).not.toHaveBeenCalled();
    });
});
