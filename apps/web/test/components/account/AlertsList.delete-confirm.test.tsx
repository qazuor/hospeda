/**
 * @file AlertsList.delete-confirm.test.tsx
 * @description HOS-2501: deleting a price alert asks first with the kit
 * ConfirmDialog (never a native `confirm()` or an inline prompt), removes the
 * row only after the DELETE succeeds, and keeps the dialog open when it fails.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsList } from '../../../src/components/account/AlertsList.client';

const ALERT = {
    id: 'alert-1',
    userId: 'user-001',
    accommodationId: 'acc-001',
    accommodationName: 'Cabaña del Río',
    basePriceSnapshot: 2500000,
    targetPercentDrop: 10,
    isActive: true,
    closedBecauseListingGone: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null
};

function mockApi({ deleteOk }: { readonly deleteOk: boolean }) {
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
        if (init?.method === 'DELETE') {
            return (
                deleteOk
                    ? { ok: true, status: 204, json: async () => ({}) }
                    : { ok: false, status: 500, json: async () => ({ success: false, error: {} }) }
            ) as Response;
        }
        return {
            ok: true,
            json: async () => ({ success: true, data: { items: [ALERT] } })
        } as Response;
    });
}

async function renderList() {
    render(
        <AlertsList
            locale="es"
            apiUrl="http://localhost:3001"
            userId="user-001"
        />
    );
    await screen.findByText('Cabaña del Río');
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal(
        'confirm',
        vi.fn(() => true)
    );
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AlertsList delete confirmation (HOS-2501)', () => {
    it('asks with the kit dialog before calling the API, never with a native confirm', async () => {
        mockApi({ deleteOk: true });
        await renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar: Cabaña del Río' }));

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('¿Eliminar esta alerta?');
        expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
            false
        );
        expect(window.confirm).not.toHaveBeenCalled();
    });

    it('removes the row once the confirmed DELETE succeeds', async () => {
        mockApi({ deleteOk: true });
        await renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar: Cabaña del Río' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));

        await waitFor(() => expect(screen.queryByText('Cabaña del Río')).not.toBeInTheDocument());
    });

    it('keeps the row and the dialog when the DELETE fails', async () => {
        mockApi({ deleteOk: false });
        await renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar: Cabaña del Río' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, eliminar' }));

        await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
        expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
    });

    it('closes without deleting when the user cancels', async () => {
        mockApi({ deleteOk: true });
        await renderList();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar: Cabaña del Río' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
    });
});
