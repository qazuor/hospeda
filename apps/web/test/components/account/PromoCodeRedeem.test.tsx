import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoCodeRedeem } from '@/components/account/PromoCodeRedeem.client';
import { promoCodeApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({ promoCodeApi: { redeem: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const id = '123e4567-e89b-42d3-a456-426614174000';
const discount = (durationKind: 'N_CHARGES' | 'FIRST_CHARGE' | 'FOREVER') => ({
    ok: true as const,
    data: {
        kind: 'DISCOUNT' as const,
        redemptionId: id,
        previousAmountMinor: 10000,
        amountMinor: 7000,
        currency: 'ARS',
        durationKind,
        remainingCharges:
            durationKind === 'N_CHARGES' ? 3 : durationKind === 'FIRST_CHARGE' ? 1 : null
    }
});

describe('AC:B9b:12 HOS-1591 TEST:B9b:12 (support) — promo redemption island', () => {
    it('shows N charges, discounted amount, later amount, and provider email', async () => {
        vi.mocked(promoCodeApi.redeem).mockResolvedValue(discount('N_CHARGES') as never);
        render(
            <PromoCodeRedeem
                vertical="accommodation"
                locale="es"
                offer="SUBSCRIPTION"
            />
        );
        fireEvent.change(screen.getByLabelText(/código/i), { target: { value: ' save 20 ' } });
        fireEvent.click(screen.getByRole('button', { name: /canjear/i }));
        const notice = await screen.findByTestId('promo-redeem-notice');
        expect(notice).toHaveTextContent('próximos 3 cobros');
        expect(notice).toHaveTextContent('$ 70,00');
        expect(notice).toHaveTextContent('$ 100,00');
        expect(notice).toHaveTextContent('Mercado Pago');
        expect(promoCodeApi.redeem).toHaveBeenCalledWith({
            code: 'SAVE20',
            vertical: 'accommodation'
        });
    });

    it('includes the promo-ending notice for the first charge', async () => {
        vi.mocked(promoCodeApi.redeem).mockResolvedValue(discount('FIRST_CHARGE') as never);
        render(
            <PromoCodeRedeem
                vertical="experience"
                locale="es"
                offer="SUBSCRIPTION"
            />
        );
        fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'ONE' } });
        fireEvent.click(screen.getByRole('button', { name: /canjear/i }));
        expect(await screen.findByTestId('promo-redeem-notice')).toHaveTextContent(
            'tu promo termina'
        );
    });

    it('does not promise a provider email for a forever discount', async () => {
        vi.mocked(promoCodeApi.redeem).mockResolvedValue(discount('FOREVER') as never);
        render(
            <PromoCodeRedeem
                vertical="venue"
                locale="es"
                offer="SUBSCRIPTION"
            />
        );
        fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'FOREVER' } });
        fireEvent.click(screen.getByRole('button', { name: /canjear/i }));
        const notice = await screen.findByTestId('promo-redeem-notice');
        expect(notice).toHaveTextContent('sin fecha de fin');
        expect(notice).not.toHaveTextContent('Mercado Pago');
    });

    it('states the number of trial days added', async () => {
        vi.mocked(promoCodeApi.redeem).mockResolvedValue({
            ok: true,
            data: { kind: 'TRIAL_EXTENSION', days: 14, replay: false }
        } as never);
        render(
            <PromoCodeRedeem
                vertical="venue"
                locale="es"
                offer="TRIAL"
            />
        );
        fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'TRIAL' } });
        fireEvent.click(screen.getByRole('button', { name: /canjear/i }));
        expect(await screen.findByTestId('promo-redeem-notice')).toHaveTextContent('14 días');
    });

    it('shows the exact provider-minimum rejection copy', async () => {
        vi.mocked(promoCodeApi.redeem).mockResolvedValue({
            ok: false,
            error: { status: 422, message: 'rejected', reason: 'PROMO_BELOW_PROVIDER_MINIMUM' }
        } as never);
        render(
            <PromoCodeRedeem
                vertical="accommodation"
                locale="es"
                offer="SUBSCRIPTION"
            />
        );
        fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'LOW' } });
        fireEvent.click(screen.getByRole('button', { name: /canjear/i }));
        await waitFor(() =>
            expect(screen.getByTestId('promo-redeem-error')).toHaveTextContent(
                'este código deja el importe por debajo del mínimo que Mercado Pago permite cobrar'
            )
        );
    });
});
