/**
 * @file EditableNote.test.tsx
 * @description Unit tests for the EditableNote inline note editor.
 *
 * Covers:
 * - T-049d: Placeholder shown when note is empty
 * - T-049d: Existing note text displayed in read view
 * - T-049d: Clicking the display triggers edit mode (textarea visible)
 * - T-049d: Escape key cancels editing and restores previous value
 * - T-049d: Cancel button collapses editor and reverts draft
 * - T-049d: Character counter shows current/max
 * - T-049d: Save button disabled when over 300 chars
 * - T-049d: Save calls PATCH with correct URL and body
 * - T-049d: onSaved callback called with new value on success
 * - T-049d: Editor collapses after successful save
 * - T-049d: Toast shown on PATCH failure; editor stays open
 * - T-049d: Save button disabled while saving (aria-busy)
 * - T-049d: Textarea has accessible aria-label
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableNote } from '../../../src/components/account/EditableNote';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/EditableNote.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Default props ────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    bookmarkId: 'bm-abc',
    initialValue: null,
    onSaved: vi.fn(),
    apiBase: 'http://localhost:3001',
    placeholder: 'Agregá una nota personal...',
    saveLabel: 'Guardar nota',
    cancelLabel: 'Cancelar',
    textareaLabel: 'Nota personal',
    editButtonLabel: 'Editar nota',
    saveErrorMessage: 'No se pudo guardar la nota'
} as const;

function renderNote(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    const props = { ...DEFAULT_PROPS, onSaved: vi.fn(), ...overrides };
    return { ...render(<EditableNote {...props} />), props };
}

function makeOkResponse(description: string) {
    return new Response(
        JSON.stringify({
            success: true,
            data: { id: 'bm-abc', description }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function makeErrorResponse() {
    return new Response(
        JSON.stringify({ success: false, error: { message: 'Error del servidor' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EditableNote', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    // ── Read view ─────────────────────────────────────────────────────────────

    it('shows placeholder when initialValue is null', () => {
        renderNote({ initialValue: null });
        expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
    });

    it('shows placeholder when initialValue is empty string', () => {
        renderNote({ initialValue: '' });
        expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
    });

    it('shows note text when initialValue has content', () => {
        renderNote({ initialValue: 'Mi nota especial' });
        expect(screen.getByText('Mi nota especial')).toBeInTheDocument();
    });

    it('read-view button has the accessible editButtonLabel', () => {
        renderNote({ initialValue: null });
        const btn = screen.getByRole('button', { name: 'Editar nota' });
        expect(btn).toBeInTheDocument();
    });

    // ── Entering edit mode ────────────────────────────────────────────────────

    it('clicking the display button shows the textarea', () => {
        renderNote({ initialValue: 'Nota existente' });
        const btn = screen.getByRole('button', { name: 'Editar nota' });
        fireEvent.click(btn);
        expect(screen.getByRole('textbox', { name: 'Nota personal' })).toBeInTheDocument();
    });

    it('textarea is pre-filled with the current note value when editing starts', () => {
        renderNote({ initialValue: 'Contenido previo' });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        expect(textarea).toHaveValue('Contenido previo');
    });

    it('textarea is empty when starting to edit an empty note', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        expect(textarea).toHaveValue('');
    });

    // ── Cancel ────────────────────────────────────────────────────────────────

    it('Cancel button collapses the editor', () => {
        renderNote({ initialValue: 'Nota' });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        expect(screen.getByRole('textbox', { name: 'Nota personal' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('pressing Escape cancels editing', () => {
        renderNote({ initialValue: 'Nota' });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });

        fireEvent.keyDown(textarea, { key: 'Escape' });
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('Cancel restores the original value (no draft leak)', () => {
        renderNote({ initialValue: 'Original' });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));

        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Cambio descartado' } });

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        // Back in read view: should show original text
        expect(screen.getByText('Original')).toBeInTheDocument();
        expect(screen.queryByText('Cambio descartado')).not.toBeInTheDocument();
    });

    // ── Character counter ─────────────────────────────────────────────────────

    it('character counter shows 0/300 for empty textarea', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        expect(screen.getByText('0/300')).toBeInTheDocument();
    });

    it('character counter updates as user types', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Hola' } });
        expect(screen.getByText('4/300')).toBeInTheDocument();
    });

    it('Save button is disabled when text exceeds 300 chars', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        const longText = 'a'.repeat(301);
        fireEvent.change(textarea, { target: { value: longText } });

        const saveBtn = screen.getByRole('button', { name: 'Guardar nota' });
        expect(saveBtn).toBeDisabled();
    });

    it('Save button is enabled when text is within 300 chars', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'a'.repeat(300) } });

        const saveBtn = screen.getByRole('button', { name: 'Guardar nota' });
        expect(saveBtn).not.toBeDisabled();
    });

    // ── Successful save ───────────────────────────────────────────────────────

    it('Save calls PATCH with correct URL and JSON body', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeOkResponse('Nota guardada'));
        globalThis.fetch = fetchMock;

        const onSaved = vi.fn();
        renderNote({ initialValue: null, onSaved });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));

        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Nota guardada' } });

        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                'http://localhost:3001/api/v1/protected/user-bookmarks/bm-abc',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ description: 'Nota guardada' })
                })
            );
        });
    });

    it('calls onSaved with the new description on successful PATCH', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(makeOkResponse('Nueva nota'));
        const onSaved = vi.fn();
        renderNote({ initialValue: null, onSaved });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));

        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Nueva nota' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            expect(onSaved).toHaveBeenCalledWith('Nueva nota');
        });
    });

    it('editor collapses after successful save', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(makeOkResponse('Guardado'));
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Guardado' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
    });

    // ── Save failure ──────────────────────────────────────────────────────────

    it('shows toast with error message when PATCH fails', async () => {
        const { addToast } = await import('../../../src/store/toast-store');
        globalThis.fetch = vi.fn().mockResolvedValue(makeErrorResponse());

        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Algo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });
    });

    it('keeps editor open after PATCH failure so user can retry', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(makeErrorResponse());

        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Algo' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            // Editor should still be visible
            expect(screen.getByRole('textbox', { name: 'Nota personal' })).toBeInTheDocument();
        });
    });

    it('Save button has aria-busy=true while saving', async () => {
        // Use a never-resolving promise to keep the loading state
        globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => undefined));

        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        const textarea = screen.getByRole('textbox', { name: 'Nota personal' });
        fireEvent.change(textarea, { target: { value: 'Guardando...' } });

        const saveBtn = screen.getByRole('button', { name: 'Guardar nota' });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(saveBtn).toHaveAttribute('aria-busy', 'true');
        });
    });

    // ── Accessibility ─────────────────────────────────────────────────────────

    it('textarea has the provided aria-label', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
        expect(screen.getByRole('textbox', { name: 'Nota personal' })).toBeInTheDocument();
    });

    it('Save and Cancel buttons are in tab order and have visible labels', () => {
        renderNote({ initialValue: null });
        fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));

        const saveBtn = screen.getByRole('button', { name: 'Guardar nota' });
        const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });

        expect(saveBtn).toBeInTheDocument();
        expect(cancelBtn).toBeInTheDocument();
        // Neither should be hidden from accessibility tree
        expect(saveBtn).toBeVisible();
        expect(cancelBtn).toBeVisible();
    });
});
