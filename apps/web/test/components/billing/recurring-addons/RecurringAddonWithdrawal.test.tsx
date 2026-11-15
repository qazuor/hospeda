import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecurringAddonWithdrawal } from '../../../../src/components/billing/recurring-addons/RecurringAddonWithdrawal.client';

const listRecurringAddons = vi.fn();
const withdrawAddon = vi.fn();
vi.mock('../../../../src/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        listRecurringAddons: (...args: unknown[]) => listRecurringAddons(...args),
        withdrawAddon: (...args: unknown[]) => withdrawAddon(...args)
    }
}));

const listingId = '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const instanceId = '3f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11';
const item = {
    addonInstanceId: instanceId,
    name: 'Destaque Alfa',
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 120000,
    currency: 'ARS',
    status: 'ACTIVE',
    targetId: listingId,
    targetName: 'Ficha Alfa'
};

describe('TEST:B13b:1 AC:B13b:1 — la baja ofrecida cancela el destaque recurrente del dueño', () => {
    afterEach(() => vi.clearAllMocks());

    it('loads the listing, confirms withdrawal, calls the instance endpoint and removes the row', async () => {
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [item] } });
        withdrawAddon.mockResolvedValue({
            ok: true,
            data: { instanceId, status: 'CANCELLED', providerCall: 'SENT' }
        });
        render(
            <RecurringAddonWithdrawal
                locale="es"
                listingId={listingId}
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('Cargando');
        expect(await screen.findByTestId(`recurring-addon-${instanceId}`)).toHaveTextContent(
            'Destaque Alfa'
        );
        expect(listRecurringAddons).toHaveBeenCalledWith({ listingId });
        fireEvent.click(screen.getByTestId(`recurring-addon-withdraw-${instanceId}`));
        expect(screen.getByTestId('recurring-addon-withdraw-confirm')).toHaveTextContent(
            'se corta el cobro'
        );
        expect(screen.getByTestId('recurring-addon-withdraw-confirm')).toHaveTextContent(
            'No hay reembolso'
        );
        const confirmButton = screen.getByRole('button', { name: 'Confirmar baja' });
        expect(document.activeElement).toBe(confirmButton);
        fireEvent.click(confirmButton);
        await waitFor(() => expect(withdrawAddon).toHaveBeenCalledWith({ instanceId }));
        await waitFor(() =>
            expect(screen.queryAllByTestId(`recurring-addon-${instanceId}`)).toHaveLength(0)
        );
        expect(screen.getByTestId('recurring-addon-withdrawn')).toHaveTextContent('dado de baja');
        expect(document.activeElement).toBe(screen.getByTestId('recurring-addon-withdrawn'));
    });

    it('restores focus to the withdrawal button when cancelling', async () => {
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [item] } });
        render(
            <RecurringAddonWithdrawal
                locale="es"
                listingId={listingId}
            />
        );
        const trigger = await screen.findByTestId(`recurring-addon-withdraw-${instanceId}`);
        trigger.focus();
        fireEvent.click(trigger);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirmar baja' }));

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(document.activeElement).toBe(
            screen.getByTestId(`recurring-addon-withdraw-${instanceId}`)
        );
    });

    it('shows a 409 response text without removing the row', async () => {
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [item] } });
        withdrawAddon.mockResolvedValue({
            ok: false,
            error: { status: 409, message: 'Este destaque ya no admite baja.' }
        });
        render(
            <RecurringAddonWithdrawal
                locale="es"
                listingId={listingId}
            />
        );
        fireEvent.click(await screen.findByTestId(`recurring-addon-withdraw-${instanceId}`));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Este destaque ya no admite baja.'
        );
        expect(screen.getAllByTestId(`recurring-addon-${instanceId}`)).toHaveLength(1);
    });

    it('shows a 404 response text without removing the row', async () => {
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [item] } });
        withdrawAddon.mockResolvedValue({
            ok: false,
            error: { status: 404, message: 'No encontramos este destaque.' }
        });
        render(
            <RecurringAddonWithdrawal
                locale="es"
                listingId={listingId}
            />
        );
        fireEvent.click(await screen.findByTestId(`recurring-addon-withdraw-${instanceId}`));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos este destaque.');
        expect(screen.getAllByTestId(`recurring-addon-${instanceId}`)).toHaveLength(1);
    });

    it('shows the empty response and never invents a row', async () => {
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
        render(
            <RecurringAddonWithdrawal
                locale="es"
                listingId={null}
            />
        );
        expect(
            await screen.findByText('No tenés destaques recurrentes activos.')
        ).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^recurring-addon-/)).toHaveLength(0);
    });
});
