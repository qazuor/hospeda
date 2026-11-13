import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumeOffer } from '@/components/account/ResumeOffer.client';

const id = '123e4567-e89b-42d3-a456-426614174000';
afterEach(() => vi.unstubAllGlobals());
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
});
