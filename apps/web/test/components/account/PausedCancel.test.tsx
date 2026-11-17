import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PausedCancel } from '@/components/account/PausedCancel.client';

const id = '123e4567-e89b-42d3-a456-426614174000';
/** Flush the mocked fetch promise chain under fake timers. */
async function flushPromises(): Promise<void> {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
describe('TEST:B8b:25 PausedCancel', () => {
    it.each([
        'NOW',
        'CREDIT'
    ] as const)('shows the %s consequence, courtesy months and POSTs S22', async (basis) => {
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data:
                    init?.method === 'POST'
                        ? {
                              subscriptionId: id,
                              outcome: basis === 'CREDIT' ? 'SCHEDULED' : 'CANCELLED',
                              serviceEndsAt: basis === 'CREDIT' ? '2026-12-05T03:00:00.000Z' : null
                          }
                        : {
                              subscriptionId: id,
                              vertical: 'accommodation',
                              paymentMethod: 'CARD',
                              origin: 'PAUSED',
                              serviceEndsAt: '2026-12-05T03:00:00.000Z',
                              basis,
                              courtesyMonthsLost: 2,
                              addons: []
                          }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);
        render(
            <PausedCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
        expect(await screen.findByTestId('paused-cancel-end')).toHaveTextContent(
            basis === 'NOW'
                ? 'Si confirmás, el servicio termina hoy, no al final de un período.'
                : 'Si confirmás, el servicio sigue hasta el fin del crédito, el 5 de diciembre de 2026.'
        );
        expect(screen.getByText('Perdés 2 meses de cortesía que te quedaban.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
        await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            expect.stringContaining(`/billing-subscription/${id}/cancellation-preview`),
            expect.stringContaining(`/billing-subscription/${id}/cancellation`)
        ]);
    });

    it('TEST:HOS-2303 reloads the SSR card once 2500 ms after cancelling a paused subscription', async () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data:
                    init?.method === 'POST'
                        ? { subscriptionId: id, outcome: 'CANCELLED', serviceEndsAt: null }
                        : {
                              subscriptionId: id,
                              vertical: 'accommodation',
                              paymentMethod: 'CARD',
                              origin: 'PAUSED',
                              serviceEndsAt: '2026-12-05T03:00:00.000Z',
                              basis: 'NOW',
                              courtesyMonthsLost: 0,
                              addons: []
                          }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers();
        render(
            <PausedCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
        await act(async () => {
            await flushPromises();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
        await act(async () => {
            await flushPromises();
        });
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(reload).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2500);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('TEST:HOS-2303 never schedules a reload when cancelling a paused subscription fails', async () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
            ok: init?.method !== 'POST',
            status: init?.method === 'POST' ? 500 : 200,
            json: async () => ({
                success: init?.method !== 'POST',
                data:
                    init?.method === 'POST'
                        ? undefined
                        : {
                              subscriptionId: id,
                              vertical: 'accommodation',
                              paymentMethod: 'CARD',
                              origin: 'PAUSED',
                              serviceEndsAt: '2026-12-05T03:00:00.000Z',
                              basis: 'NOW',
                              courtesyMonthsLost: 0,
                              addons: []
                          }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers();
        render(
            <PausedCancel
                subscriptionId={id}
                locale="es"
                planName="Básico"
                verticalLabel="Alojamiento"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
        await act(async () => {
            await flushPromises();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
        await act(async () => {
            await flushPromises();
        });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2500);
        });
        expect(reload).not.toHaveBeenCalled();
    });
});
