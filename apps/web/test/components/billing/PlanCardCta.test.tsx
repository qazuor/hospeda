import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCardCta } from '@/components/billing/PlanCardCta.client';
import { resetPricingSituationCacheForTests } from '@/lib/billing/pricing-situation';

const pricingSituation = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { pricingSituation } }));
beforeEach(() => {
    vi.clearAllMocks();
    resetPricingSituationCacheForTests();
});

describe('PlanCardCta', () => {
    it('renders exact monthly and annual checkout links from the shared situation read', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <PlanCardCta
                locale="es"
                vertical="accommodation"
                planVersionId="v1"
                billingOptions={{ monthly: 'm1', annual: 'a1' }}
            />
        );
        const root = await screen.findByTestId('pricing-card-cta');
        expect(root).toHaveAttribute('data-kind', 'checkout');
        expect(root).toHaveAttribute('data-loaded', 'true');
        expect(screen.getByRole('link', { name: 'Suscribirme con pago mensual' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=m1'
        );
        expect(screen.getByRole('link', { name: 'Suscribirme con pago anual' })).toHaveAttribute(
            'href',
            '/es/suscriptores/checkout/?opcion=a1'
        );
    });

    it('shares one request across two cards in the same vertical', async () => {
        pricingSituation.mockResolvedValue({ ok: true, data: { situation: 'CHECKOUT' } });
        render(
            <>
                <PlanCardCta
                    locale="es"
                    vertical="accommodation"
                    planVersionId="v1"
                    billingOptions={{ monthly: 'm1', annual: null }}
                />
                <PlanCardCta
                    locale="es"
                    vertical="accommodation"
                    planVersionId="v2"
                    billingOptions={{ monthly: 'm2', annual: null }}
                />
            </>
        );
        expect(await screen.findAllByTestId('pricing-card-cta')).toHaveLength(2);
        expect(pricingSituation).toHaveBeenCalledTimes(1);
    });
});
