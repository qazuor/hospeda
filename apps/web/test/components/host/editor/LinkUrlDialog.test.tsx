/**
 * @file LinkUrlDialog.test.tsx
 * @description RTL tests for the rich-text editor's link dialog (HOS-957),
 * which replaced `window.prompt('URL del enlace', previous)`.
 *
 * The contract under test is the one the native prompt had, because the caller
 * still branches on all three of its outcomes:
 *
 *  - cancel        → `onCancel`, the link is untouched;
 *  - empty submit  → `onSubmit('')`, which REMOVES the link. This is the only
 *                    way to unlink a selection, so collapsing it into a cancel
 *                    would be a silent feature loss;
 *  - value submit  → `onSubmit(url)`.
 *
 * Plus the two things the prompt got for free and a custom dialog does not:
 * Enter submits, and the field is re-seeded from the CURRENT selection every
 * time the dialog opens.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkUrlDialog } from '@/components/host/editor/LinkUrlDialog.client';

vi.mock('@/components/host/editor/LinkUrlDialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="presentation">{children}</div> : null,
    DialogHeader: ({ children, titleId }: { children: React.ReactNode; titleId: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const onSubmit = vi.fn();
const onCancel = vi.fn();

const renderDialog = (overrides: Record<string, unknown> = {}) =>
    render(
        <LinkUrlDialog
            isOpen={true}
            initialUrl=""
            title="Enlace"
            label="URL del enlace"
            hint="Dejá el campo vacío para quitar el enlace."
            placeholder="https://ejemplo.com"
            submitLabel="Aplicar"
            cancelLabel="Cancelar"
            closeLabel="Cerrar"
            onSubmit={onSubmit}
            onCancel={onCancel}
            {...overrides}
        />
    );

const field = (): HTMLInputElement => screen.getByLabelText(/URL del enlace/);

describe('LinkUrlDialog', () => {
    beforeEach(() => {
        onSubmit.mockReset();
        onCancel.mockReset();
    });

    it('renders nothing while closed', () => {
        renderDialog({ isOpen: false });
        expect(screen.queryByText('Enlace')).not.toBeInTheDocument();
    });

    it('renders the title, the labelled field and the hint', () => {
        renderDialog();
        expect(screen.getByText('Enlace')).toBeInTheDocument();
        expect(field()).toBeInTheDocument();
        expect(screen.getByText('Dejá el campo vacío para quitar el enlace.')).toBeInTheDocument();
    });

    it("pre-fills the selection's current URL, the way the prompt's second argument did", () => {
        renderDialog({ initialUrl: 'https://hospeda.com.ar' });
        expect(field().value).toBe('https://hospeda.com.ar');
    });

    it('submits the typed URL', () => {
        renderDialog();
        fireEvent.change(field(), { target: { value: 'https://example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
        expect(onSubmit).toHaveBeenCalledWith('https://example.com');
    });

    it('trims the value, so a stray space does not become part of the href', () => {
        renderDialog();
        fireEvent.change(field(), { target: { value: '  https://example.com  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
        expect(onSubmit).toHaveBeenCalledWith('https://example.com');
    });

    it('submits an EMPTY string when the field is cleared — the removal arm', () => {
        renderDialog({ initialUrl: 'https://example.com' });
        fireEvent.change(field(), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
        expect(onSubmit).toHaveBeenCalledWith('');
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('submits on Enter, which the native prompt did for free', () => {
        renderDialog();
        fireEvent.change(field(), { target: { value: 'https://example.com' } });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(onSubmit).toHaveBeenCalledWith('https://example.com');
    });

    it('does not submit on any other key', () => {
        renderDialog();
        fireEvent.change(field(), { target: { value: 'https://example.com' } });
        fireEvent.keyDown(field(), { key: 'a' });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('cancels without touching the link', () => {
        renderDialog({ initialUrl: 'https://example.com' });
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('re-seeds the field on every open, not just on mount', () => {
        const { rerender } = render(
            <LinkUrlDialog
                isOpen={false}
                initialUrl=""
                title="Enlace"
                label="URL del enlace"
                hint="hint"
                placeholder="https://ejemplo.com"
                submitLabel="Aplicar"
                cancelLabel="Cancelar"
                closeLabel="Cerrar"
                onSubmit={onSubmit}
                onCancel={onCancel}
            />
        );

        const open = (initialUrl: string): void => {
            rerender(
                <LinkUrlDialog
                    isOpen={true}
                    initialUrl={initialUrl}
                    title="Enlace"
                    label="URL del enlace"
                    hint="hint"
                    placeholder="https://ejemplo.com"
                    submitLabel="Aplicar"
                    cancelLabel="Cancelar"
                    closeLabel="Cerrar"
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                />
            );
        };

        open('https://first.example');
        expect(field().value).toBe('https://first.example');

        // Editing a SECOND link must not arrive pre-filled with the first one's
        // URL — the component stays mounted between openings.
        open('https://second.example');
        expect(field().value).toBe('https://second.example');
    });
});
