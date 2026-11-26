import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TouristPlanAction } from '@/components/billing/TouristPlanAction.client';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/billing/pricing-situation', () => ({ loadPricingSituation: load }));

const plans = [
    { name: 'Base', monthlyPriceArs: 0, sortOrder: 0, isActive: true },
    {
        name: 'Travel Plus',
        monthlyPriceArs: 1_500_000,
        planVersionId: 'plus',
        sortOrder: 1,
        isActive: true,
        billingOptions: { monthly: 'monthly-plus', annual: null }
    }
];
const props = { locale: 'es', plans, href: '/es/planes/turistas/', label: 'Ver planes' } as const;
const inherited = { ok: true, data: { situation: 'TOURIST_VIP_INHERITED' } } as const;

describe('tourist commercial action', () => {
    it('renders the catalog offer without a session in public HTML', () => {
        const html = renderToString(<TouristPlanAction {...props} />);

        expect(html).toContain('Base o Travel Plus desde');
        expect(html).toContain('15.000');
        expect(html).not.toContain('Tu plan actual');
        expect(load).not.toHaveBeenCalled();
    });

    it.each([
        false,
        true
    ])('uses the theme-aware flat accent CTA before hydration (full width: %s)', (fullWidth) => {
        const html = renderToString(
            <TouristPlanAction
                {...props}
                fullWidth={fullWidth}
            />
        );
        const link = new DOMParser().parseFromString(html, 'text/html').querySelector('a');

        expect(link?.textContent).toBe(props.label);
        expect([...(link?.classList ?? [])]).toEqual(
            expect.arrayContaining(['btn-gradient--accent', 'btn-gradient--flat'])
        );
        expect(link?.classList.contains('fullWidth')).toBe(fullWidth);
    });

    it('names the catalog floor and upgrades a signed-in free traveler', async () => {
        load.mockResolvedValueOnce({ ok: true, data: { situation: 'CHECKOUT' } });

        render(<TouristPlanAction {...props} />);

        expect(await screen.findByText('Tu plan actual: Base')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Pasate a Travel Plus' })).toHaveAttribute(
            'href',
            props.href
        );
    });

    it('lets the paid subscriber manage instead of buying again', async () => {
        load.mockResolvedValueOnce({
            ok: true,
            data: { situation: 'SUBSCRIBED', status: 'ACTIVE', planVersionId: 'plus' }
        });

        render(<TouristPlanAction {...props} />);

        expect(await screen.findByText('Tu plan actual: Travel Plus')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Gestionar mi plan' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/suscripcion/?domain=tourist'
        );
        expect(screen.queryByText(/desde/)).not.toBeInTheDocument();
    });

    it('explains inherited VIP and links to usable benefits without offering management', async () => {
        load.mockResolvedValueOnce(inherited);
        const catalog = [
            ...plans,
            {
                name: 'Travel Premium',
                monthlyPriceArs: 2_000_000,
                planVersionId: 'premium',
                sortOrder: 2,
                entitlements: ['vip_promotions_access'],
                isActive: true,
                billingOptions: { monthly: 'monthly-premium', annual: null }
            }
        ];

        render(
            <TouristPlanAction
                {...props}
                plans={catalog}
                mode="compare"
            />
        );

        expect(
            await screen.findByText('Tu plan ya incluye Turista VIP: no hace falta comprarlo.')
        ).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Gestionar mi plan' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: props.label })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /promociones/i })).toHaveAttribute(
            'href',
            '/es/promociones/'
        );
        expect(screen.queryByText(/Pasate a|desde|Tu plan actual: Base/)).not.toBeInTheDocument();
    });

    it('marks only the inherited comparison column and never the free card', async () => {
        load.mockResolvedValue(inherited);

        render(
            <>
                <div data-testid="free-card">
                    <TouristPlanAction
                        {...props}
                        plans={plans.slice(0, 1)}
                        mode="freeCard"
                    />
                </div>
                <div data-testid="free-column">
                    <TouristPlanAction
                        {...props}
                        mode="column"
                        planVersionId="floor"
                    />
                </div>
                <div data-testid="paid-column">
                    <TouristPlanAction
                        {...props}
                        mode="column"
                        planVersionId="plus"
                    />
                </div>
            </>
        );

        const marker = await within(screen.getByTestId('paid-column')).findByText('Tu plan actual');
        expect(marker).toHaveAttribute('data-current-tourist-plan');
        expect(within(screen.getByTestId('free-card')).queryByText('Tu plan actual')).toBeNull();
        expect(within(screen.getByTestId('free-column')).queryByText('Tu plan actual')).toBeNull();
    });
});
