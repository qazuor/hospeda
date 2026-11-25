import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
    SignupCheckout,
    type SignupCheckoutProps
} from '@/components/billing/SignupCheckout.client';

vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: { start: vi.fn() } }));

const props = {
    locale: 'es',
    billingOptionId: 'option-annual',
    accountEmail: 'payer@example.test',
    vertical: 'tourist',
    plansHref: '/es/planes/turistas/precios/',
    trialNotice: null,
    touristVipNotice: null,
    pendingAttempt: null,
    manualPaymentOnly: false,
    planSummary: { name: 'VIP', amount: 15000000, currency: 'ARS', cycle: 'annual' }
} satisfies SignupCheckoutProps;

describe('checkout kit summary', () => {
    it('server-renders the selected plan, vertical, period and catalog total before hydration', () => {
        const html = renderToStaticMarkup(<SignupCheckout {...props} />);
        expect(html).toContain('data-kit-section');
        expect(html).toContain('<dl');
        expect(html).toContain('VIP');
        expect(html).toContain('Turista VIP');
        expect(html).toContain('por año');
        expect(html).toContain('150.000');
        expect(html).not.toContain('data-hydrated');
    });

    it.each([
        ['es', 'Confirmá tu suscripción', 'Volver', 'Total por período'],
        ['en', 'Confirm your subscription', 'Back', 'Total per period'],
        ['pt', 'Confirme sua assinatura', 'Voltar', 'Total por período']
    ] as const)('localizes the heading, summary labels and back action in %s', (locale, title, back, total) => {
        render(
            <SignupCheckout
                {...props}
                locale={locale}
            />
        );
        expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: back })).toHaveAttribute('href', props.plansHref);
        const summary = screen.getByTestId('signup-checkout-plan-summary');
        expect(within(summary).getByText(total, { selector: 'dt' })).toBeInTheDocument();
        expect(summary.querySelectorAll('dt')).toHaveLength(4);
        expect(screen.getByTestId('signup-checkout-back').parentElement).toBe(
            screen.getByTestId('signup-checkout-confirm').parentElement
        );
    });
});
