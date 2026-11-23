/**
 * @file CollectionDetailActions.test.tsx
 * @description Tests for the collection detail actions on the account kit
 * (SPEC-228 T-019, HOS-957, HOS-2480).
 *
 * Covers:
 * - Edit and Delete render as kit buttons with their labels
 * - Delete asks through the kit ConfirmDialog (never `window.confirm`)
 * - Cancelling the confirmation never deletes (HOS-957)
 * - Accepting deletes; while it runs the confirm button is busy
 * - A failed delete keeps the dialog open (its error and retry)
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionDetailActions } from '../../../src/components/account/CollectionDetailActions.client';

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: () => null
}));

const deleteMock = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        delete: (...args: unknown[]) => deleteMock(...args)
    }
}));

const COLLECTION = {
    id: 'col-1',
    name: 'Viajes soñados',
    description: null,
    color: '#4f46e5',
    icon: null
};

function renderActions() {
    return render(
        <CollectionDetailActions
            collection={COLLECTION}
            locale="es"
        />
    );
}

describe('CollectionDetailActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Edit and Delete buttons with their labels', () => {
        renderActions();
        expect(screen.getByTestId('collection-actions-edit')).toHaveTextContent('Editar colección');
        const deleteBtn = screen.getByTestId('collection-actions-delete');
        expect(deleteBtn).toHaveTextContent('Borrar colección');
        expect(deleteBtn).toBeEnabled();
    });

    it('asks through the kit ConfirmDialog, never window.confirm (HOS-957)', async () => {
        const nativeConfirm = vi.spyOn(window, 'confirm');
        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));

        const dialog = await screen.findByRole('alertdialog');
        expect(
            within(dialog).getByText(/Los favoritos quedarán sin colección/)
        ).toBeInTheDocument();
        expect(nativeConfirm).not.toHaveBeenCalled();
        nativeConfirm.mockRestore();
    });

    it('does NOT delete when the confirmation is cancelled (HOS-957)', async () => {
        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));
        const dialog = await screen.findByRole('alertdialog');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it('deletes once the confirmation is accepted, busy while it runs (HOS-957)', async () => {
        // Never resolves, so the busy state can be inspected (and jsdom never
        // reaches the redirect it cannot perform).
        deleteMock.mockReturnValue(new Promise(() => undefined));
        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));
        const dialog = await screen.findByRole('alertdialog');
        const confirm = within(dialog).getByRole('button', { name: 'Borrar colección' });

        fireEvent.click(confirm);

        await waitFor(() => expect(deleteMock).toHaveBeenCalledWith({ id: 'col-1' }));
        await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'));
    });

    it('keeps the dialog open when the delete fails', async () => {
        deleteMock.mockResolvedValue({ ok: false, error: { code: 'BOOM', message: 'boom' } });
        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));
        const dialog = await screen.findByRole('alertdialog');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar colección' }));

        await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('does not render the ⏳ emoji in any state', () => {
        renderActions();
        expect(document.body.textContent).not.toContain('⏳');
    });
});
