/**
 * @file ConfirmDeleteDialog.test.tsx
 * @description RTL tests for the shared delete-confirmation dialog (HOS-794).
 *
 * Covers:
 * 1. Closed when `isOpen` is false; renders title/message/detail when open.
 * 2. `detail` is optional.
 * 3. Confirm and cancel fire their callbacks.
 * 4. `isBusy` swaps the CTA label, disables BOTH buttons, and shuts every
 *    close path (Escape + overlay click) so a delete in flight cannot be
 *    dismissed out from under itself.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteDialog } from '@/components/shared/ui/ConfirmDeleteDialog.client';

vi.mock('@/components/shared/ui/ConfirmDeleteDialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

/** Props the stubbed `Dialog` was last rendered with. */
const dialogProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ isOpen, children, ...rest }: { isOpen: boolean; children: React.ReactNode }) => {
        dialogProps.current = { isOpen, ...rest };
        return isOpen ? <div role="presentation">{children}</div> : null;
    },
    DialogHeader: ({ children, titleId }: { children: React.ReactNode; titleId: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const onConfirm = vi.fn();
const onCancel = vi.fn();

const renderDialog = (overrides: Record<string, unknown> = {}) =>
    render(
        <ConfirmDeleteDialog
            isOpen={true}
            title="Eliminar pregunta"
            message="¿Eliminás esta pregunta?"
            detail="¿Cuándo es el check-in?"
            confirmLabel="Eliminar pregunta"
            busyLabel="Eliminando..."
            cancelLabel="Cancelar"
            closeLabel="Cerrar"
            onConfirm={onConfirm}
            onCancel={onCancel}
            {...overrides}
        />
    );

describe('ConfirmDeleteDialog', () => {
    beforeEach(() => {
        onConfirm.mockReset();
        onCancel.mockReset();
        dialogProps.current = {};
    });

    it('renders nothing when closed', () => {
        renderDialog({ isOpen: false });
        expect(screen.queryByText('¿Eliminás esta pregunta?')).not.toBeInTheDocument();
    });

    it('shows the title, the message and the record being deleted', () => {
        renderDialog();
        expect(screen.getByText('¿Eliminás esta pregunta?')).toBeInTheDocument();
        expect(screen.getByText('¿Cuándo es el check-in?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Eliminar pregunta' })).toBeInTheDocument();
    });

    it('omits the detail line when no detail is given', () => {
        renderDialog({ detail: undefined });
        expect(screen.queryByText('¿Cuándo es el check-in?')).not.toBeInTheDocument();
        expect(screen.getByText('¿Eliminás esta pregunta?')).toBeInTheDocument();
    });

    it('fires onConfirm from the destructive CTA and onCancel from the dismissing one', () => {
        renderDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('locks itself while the delete is in flight', () => {
        renderDialog({ isBusy: true });

        // The CTA reports progress instead of inviting a second click.
        expect(screen.queryByRole('button', { name: 'Eliminar pregunta' })).not.toBeInTheDocument();
        const busyCta = screen.getByRole('button', { name: 'Eliminando...' });
        expect(busyCta).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

        // Escape and the overlay are shut too — otherwise the dialog could be
        // dismissed mid-request and the outcome would land nowhere.
        expect(dialogProps.current.closeOnEscape).toBe(false);
        expect(dialogProps.current.closeOnOverlayClick).toBe(false);
    });

    it('leaves Escape and the overlay usable when idle', () => {
        renderDialog();
        expect(dialogProps.current.closeOnEscape).toBe(true);
        expect(dialogProps.current.closeOnOverlayClick).toBe(true);
    });

    it('does not let the header close path fire while busy', () => {
        renderDialog({ isBusy: true });
        const onClose = dialogProps.current.onClose as () => void;
        onClose();
        expect(onCancel).not.toHaveBeenCalled();
    });
});
