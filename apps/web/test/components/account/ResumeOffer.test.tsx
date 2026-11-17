import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumeOffer } from '@/components/account/ResumeOffer.client';

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
describe('TEST:B8b:25 ResumeOffer', () => {
    it('confirms today, posts the owned resume, and reports only the next charge date and amount', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data: {
                    outcome: 'RESUMED',
                    nextCharge: {
                        at: '2026-12-05T03:00:00.000Z',
                        amountMinor: 250000,
                        currency: 'ARS'
                    }
                }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);
        render(
            <ResumeOffer
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reanudar suscripción' }));
        expect(screen.getByTestId('resume-confirmation').textContent).toBe(
            'Tu suscripción se reanuda hoy y te mostramos el día del próximo cobro.Confirmar reanudación'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
        await waitFor(() =>
            expect(screen.getByTestId('resume-result').textContent).toBe(
                'Te vamos a cobrar el 5 de diciembre de 2026: $ 2.500.'
            )
        );
        expect(fetchMock.mock.calls[0][0]).toContain(`/billing-subscription/${id}/resume`);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    });

    it('TEST:HOS-2303 reloads the SSR card once 2500 ms after a confirmed resume', async () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data: {
                    outcome: 'RESUMED',
                    nextCharge: {
                        at: '2026-12-05T03:00:00.000Z',
                        amountMinor: 250000,
                        currency: 'ARS'
                    }
                }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers();
        render(
            <ResumeOffer
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reanudar suscripción' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
        await act(async () => {
            await flushPromises();
        });
        expect(screen.getByTestId('resume-result')).toBeInTheDocument();
        expect(reload).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2500);
        });
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('TEST:HOS-2303 never schedules a reload when the resume fails', async () => {
        const reload = vi.fn();
        vi.stubGlobal('location', { reload });
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 500,
            json: async () => ({ success: false })
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers();
        render(
            <ResumeOffer
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Reanudar suscripción' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
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
