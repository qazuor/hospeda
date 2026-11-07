import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PauseOffer } from '@/components/account/PauseOffer.client';

const id = '123e4567-e89b-42d3-a456-426614174000';
const response = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data })
});
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
            ? response({
                  outcome: 'PAUSED',
                  pauseId: id,
                  expectedEndAt: '2027-01-05T03:00:00.000Z',
                  complements: { results: [] }
              })
            : response({
                  offered: true,
                  months: { min: 1, max: 2 },
                  expectedEndAtByMonths: {
                      '1': '2026-12-05T03:00:00.000Z',
                      '2': '2027-01-05T03:00:00.000Z'
                  },
                  quota: { pausesLeft: 2, monthsLeft: 2 },
                  addons: {
                      vertical: ['Galería'],
                      account: [
                          { name: 'Destacado', pauses: true },
                          { name: 'Cuenta', pauses: false }
                      ]
                  }
              })
    );
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('TEST:B8b:25 PauseOffer', () => {
    it('shows the complete dated confirmation and posts the selected duration', async () => {
        render(
            <PauseOffer
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Pausar suscripción' }));
        const panel = await screen.findByTestId('pause-confirmation');
        fireEvent.change(screen.getByLabelText('Meses de pausa'), { target: { value: '2' } });
        expect(
            within(panel).getByText(
                'Si confirmás, tu suscripción queda pausada hasta el 5 de enero de 2027.'
            )
        ).toBeInTheDocument();
        expect(
            within(panel).getByText(
                'Tu ficha sale del sitio público hoy. Vuelve sola al reanudar si el cupo del plan alcanza. Durante la pausa no se archiva, no se borra ni recibe avisos de retención; el reloj se detiene y arranca de cero al volver.'
            )
        ).toBeInTheDocument();
        expect(
            within(panel).getByText(
                'Los addons recurrentes de esta vertical se pausan por los mismos meses y vuelven con el plan:'
            )
        ).toBeInTheDocument();
        expect(within(panel).getByText('Galería')).toBeInTheDocument();
        expect(
            within(panel).getByText(
                'Destacado se pausa porque no queda otra vertical compatible activa.'
            )
        ).toBeInTheDocument();
        expect(
            within(panel).getByText('Cuenta sigue activo porque queda otra vertical compatible.')
        ).toBeInTheDocument();
        expect(panel.textContent).toBe(
            'Si confirmás, tu suscripción queda pausada hasta el 5 de enero de 2027.Tu ficha sale del sitio público hoy. Vuelve sola al reanudar si el cupo del plan alcanza. Durante la pausa no se archiva, no se borra ni recibe avisos de retención; el reloj se detiene y arranca de cero al volver.Los addons recurrentes de esta vertical se pausan por los mismos meses y vuelven con el plan:GaleríaDestacado se pausa porque no queda otra vertical compatible activa.Cuenta sigue activo porque queda otra vertical compatible.Confirmar pausa'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar pausa' }));
        await waitFor(() =>
            expect(screen.getByRole('status')).toHaveTextContent('5 de enero de 2027')
        );
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            expect.stringContaining(`/billing-subscription/${id}/pause-preview`),
            expect.stringContaining(`/billing-subscription/${id}/pause`)
        ]);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ months: 2 });
    });
    it('explains a courtesy refusal with its date and renders no action control', async () => {
        fetchMock.mockResolvedValue(
            response({
                offered: false,
                reason: 'COURTESY_IN_FORCE',
                courtesyEndsAt: '2026-12-05T03:00:00.000Z'
            })
        );
        render(
            <PauseOffer
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Pausar suscripción' }));
        expect(await screen.findByTestId('pause-refusal')).toHaveTextContent(
            'Tenés una cortesía hasta el 5 de diciembre de 2026; mientras dure no podés pausar.'
        );
        expect(within(screen.getByTestId('pause-offer')).queryAllByRole('button')).toEqual([]);
    });
});
