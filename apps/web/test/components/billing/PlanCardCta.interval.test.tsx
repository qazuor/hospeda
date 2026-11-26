import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCardCta } from '@/components/billing/PlanCardCta.client';
import { resetPricingSituationCacheForTests } from '@/lib/billing/pricing-situation';

const { pricingSituation, listMine } = vi.hoisted(() => ({
    pricingSituation: vi.fn(),
    listMine: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { pricingSituation, listMine }
}));
const props = {
    locale: 'es',
    vertical: 'accommodation',
    planVersionId: 'v1',
    billingOptions: { monthly: 'm1', annual: 'a1' }
} as const;

beforeEach(() => {
    vi.resetAllMocks();
    resetPricingSituationCacheForTests();
    listMine.mockResolvedValue({
        ok: true,
        data: {
            subscriptions: [
                {
                    vertical: 'accommodation',
                    status: 'ACTIVE',
                    promo: null,
                    succession: null,
                    paymentMethod: 'CARD'
                }
            ]
        }
    });
});

describe('plan card interval actions', () => {
    it.each([
        ['m1', 'Pasar a pago anual', 'annual'],
        ['a1', 'Pasar a pago mensual', 'monthly']
    ])('labels the alternative cycle of current %s without claiming a plan change', async (billingOptionId, label, cycle) => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: {
                situation: 'SUBSCRIBED',
                status: 'ACTIVE',
                planVersionId: 'v1',
                billingOptionId
            }
        });
        render(<PlanCardCta {...props} />);
        expect(await screen.findByText('Tu plan actual en alojamiento')).toHaveAttribute(
            'data-tone',
            'success'
        );
        expect(await screen.findByRole('button', { name: label })).toHaveAttribute(
            'data-cycle',
            cycle
        );
        expect(
            screen.queryByRole('button', { name: /Cambiar a este plan/ })
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute(
            'data-has-both-cycles',
            'true'
        );
    });

    it('uses the flat accent kit for both tourist checkout cycles', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <PlanCardCta
                {...props}
                vertical="tourist"
            />
        );
        expect(
            await screen.findByRole('link', { name: 'Suscribirme con pago mensual' })
        ).toHaveClass('accent');
        expect(screen.getByRole('link', { name: 'Suscribirme con pago anual' })).toHaveClass(
            'accent'
        );
    });

    it('marks checkout links by cycle and opts dual options into filtering', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(<PlanCardCta {...props} />);
        expect(
            await screen.findByRole('link', { name: 'Suscribirme con pago anual' })
        ).toHaveAttribute('data-cycle', 'annual');
        expect(screen.getByRole('link', { name: 'Suscribirme con pago mensual' })).toHaveAttribute(
            'data-cycle',
            'monthly'
        );
        expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute(
            'data-has-both-cycles',
            'true'
        );
    });

    it('marks the inherited paid card and offers management without checkout or cycle changes', async () => {
        pricingSituation.mockResolvedValue({
            ok: true,
            data: { situation: 'TOURIST_VIP_INHERITED' }
        });

        render(
            <PlanCardCta
                {...props}
                vertical="tourist"
                inheritedPlanVersionId="v1"
            />
        );

        expect(await screen.findByText('Tu plan actual')).toHaveAttribute('data-tone', 'success');
        expect(screen.getByRole('link', { name: 'Gestionar mi plan' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/suscripcion/?domain=tourist'
        );
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(listMine).not.toHaveBeenCalled();
    });

    it('keeps a monthly-only plan available under either grid interval', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <PlanCardCta
                {...props}
                billingOptions={{ monthly: 'm1', annual: null }}
            />
        );
        expect(
            await screen.findByRole('link', { name: 'Suscribirme con pago mensual' })
        ).toHaveAttribute('data-cycle', 'monthly');
        expect(screen.getByTestId('pricing-card-cta')).toHaveAttribute(
            'data-has-both-cycles',
            'false'
        );
    });
});
