/**
 * Tests for ConfirmDialog and useConfirm (HOS-2413 T-013).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    ConfirmDialog,
    type UseConfirmResult,
    useConfirm
} from '../../../../src/components/account/ui';

describe('ConfirmDialog', () => {
    function renderConfirm(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                title="Eliminar carta"
                description="Se pierden los platos."
                confirmLabel="Eliminar carta"
                locale="es"
                onConfirm={onConfirm}
                onCancel={onCancel}
                {...overrides}
            />
        );
        return { onCancel, onConfirm };
    }

    it('is an alertdialog and focuses Cancel, never the destructive button', async () => {
        renderConfirm();
        const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar carta' });
        expect(dialog).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());
    });

    it('links its description with aria-describedby', async () => {
        renderConfirm();
        const dialog = await screen.findByRole('alertdialog');
        const id = dialog.getAttribute('aria-describedby') ?? '';
        expect(document.getElementById(id)).toHaveTextContent('Se pierden los platos.');
    });

    it('Escape cancels', async () => {
        const { onCancel, onConfirm } = renderConfirm();
        await screen.findByRole('alertdialog');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('uses the danger variant when destructive and primary when neutral', async () => {
        const { unmount } = render(
            <ConfirmDialog
                open
                title="t"
                description="d"
                confirmLabel="Eliminar"
                locale="es"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        expect(await screen.findByRole('button', { name: 'Eliminar' })).toHaveClass('danger');
        unmount();
        render(
            <ConfirmDialog
                open
                title="t"
                description="d"
                confirmLabel="Seguir"
                tone="neutral"
                locale="es"
                onConfirm={() => {}}
                onCancel={() => {}}
            />
        );
        expect(await screen.findByRole('button', { name: 'Seguir' })).toHaveClass('primary');
    });

    it('keeps the dialog open and shows a translated error when onConfirm rejects', async () => {
        const user = userEvent.setup();
        const { onCancel } = renderConfirm({
            onConfirm: vi.fn().mockRejectedValue(new Error('raw API message'))
        });
        await user.click(await screen.findByRole('button', { name: 'Eliminar carta' }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('No pudimos completar la acción');
        expect(screen.queryByText('raw API message')).toBeNull();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(onCancel).not.toHaveBeenCalled();
    });
});

describe('useConfirm', () => {
    function Harness({ onResult }: { readonly onResult: (answer: boolean) => void }) {
        const api: UseConfirmResult = useConfirm({ locale: 'es' });
        return (
            <>
                <button
                    type="button"
                    onClick={async () =>
                        onResult(
                            await api.confirm({
                                title: 'Borrar',
                                description: 'Seguro',
                                confirmLabel: 'Borrar cuenta',
                                onConfirm: () => new Promise((resolve) => setTimeout(resolve, 5))
                            })
                        )
                    }
                >
                    ask
                </button>
                {api.confirmDialog}
            </>
        );
    }

    it('resolves true after the async confirm work', async () => {
        const user = userEvent.setup();
        const onResult = vi.fn();
        render(<Harness onResult={onResult} />);
        await user.click(screen.getByText('ask'));
        await user.click(await screen.findByRole('button', { name: 'Borrar cuenta' }));
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    });

    it('resolves false on Escape', async () => {
        const user = userEvent.setup();
        const onResult = vi.fn();
        render(<Harness onResult={onResult} />);
        await user.click(screen.getByText('ask'));
        await screen.findByRole('alertdialog');
        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    });
});
