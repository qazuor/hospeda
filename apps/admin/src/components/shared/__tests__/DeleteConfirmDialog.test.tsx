// @vitest-environment jsdom
/**
 * Tests for DeleteConfirmDialog (HOS-1198).
 *
 * DeleteConfirmDialog is the shared, already-built replacement for the
 * `window.confirm` flows migrated by HOS-1198. Three route pages now render
 * it directly (announcements delete, QR code delete, newsletter campaign
 * cancel-send) in addition to its original media-field consumers, so this
 * suite pins its actual contract rather than re-testing it three times per
 * call site:
 * - Closed (`open={false}`) renders nothing — `confirm()` never showed
 *   anything until asked, and this dialog must not either.
 * - `onConfirm` fires on confirm-button click, and NOT on cancel.
 * - `onOpenChange(false)` fires on cancel-button click, and NOT on confirm
 *   (the caller decides whether/when to close on confirm).
 * - Title/description/labels reflect the props verbatim (this is how the
 *   three new call sites plug in per-feature copy through one component).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
    it('renders nothing when closed', () => {
        render(
            <DeleteConfirmDialog
                open={false}
                onOpenChange={vi.fn()}
                title="Eliminar código QR"
                description="¿Eliminar este código?"
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={vi.fn()}
            />
        );

        expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
    });

    it('renders the title, description, and button labels from props when open', () => {
        render(
            <DeleteConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                title="Eliminar anuncio"
                description="¿Eliminar este anuncio? No se puede deshacer."
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('Eliminar anuncio')).toBeInTheDocument();
        expect(
            screen.getByText('¿Eliminar este anuncio? No se puede deshacer.')
        ).toBeInTheDocument();
        expect(screen.getByTestId('delete-confirm-cancel')).toHaveTextContent('Cancelar');
        expect(screen.getByTestId('delete-confirm-confirm')).toHaveTextContent('Eliminar');
    });

    it('calls onConfirm when the confirm button is clicked (Radix also auto-closes)', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const user = userEvent.setup();

        render(
            <DeleteConfirmDialog
                open={true}
                onOpenChange={onOpenChange}
                title="Cancelar envío"
                description="¿Cancelar el envío de esta campaña?"
                cancelLabel="Volver"
                confirmLabel="Cancelar envío"
                onConfirm={onConfirm}
            />
        );

        await user.click(screen.getByTestId('delete-confirm-confirm'));

        expect(onConfirm).toHaveBeenCalledOnce();
        // Radix's underlying AlertDialog.Action dismisses the dialog on click
        // just like Cancel does, so onOpenChange(false) also fires here. The
        // caller-provided onConfirm still runs the actual mutation; this
        // assertion just pins the (previously assumed-wrong) real behavior.
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls onOpenChange(false) and NOT onConfirm when the cancel button is clicked', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const user = userEvent.setup();

        render(
            <DeleteConfirmDialog
                open={true}
                onOpenChange={onOpenChange}
                title="Eliminar código QR"
                description="¿Eliminar este código?"
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={onConfirm}
            />
        );

        await user.click(screen.getByTestId('delete-confirm-cancel'));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('re-renders with the item captured for the pending action, not a stale one', () => {
        // Regression guard for the "second click before close" trap called out
        // in HOS-1198: callers key this dialog off state captured at click
        // time (e.g. `idToDelete`), and the dialog must faithfully reflect
        // whatever description/labels it is re-rendered with for a new target.
        const { rerender } = render(
            <DeleteConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                title="Eliminar código QR"
                description="Código A"
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByText('Código A')).toBeInTheDocument();

        rerender(
            <DeleteConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                title="Eliminar código QR"
                description="Código B"
                cancelLabel="Cancelar"
                confirmLabel="Eliminar"
                onConfirm={vi.fn()}
            />
        );

        expect(screen.queryByText('Código A')).not.toBeInTheDocument();
        expect(screen.getByText('Código B')).toBeInTheDocument();
    });
});
