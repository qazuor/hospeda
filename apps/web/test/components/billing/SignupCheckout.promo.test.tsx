import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupCheckout } from '@/components/billing/SignupCheckout.client';
import {
    resolveSignupPendingAttempt,
    resolveSignupPlanSummary
} from '@/lib/billing/signup-checkout';

const api = vi.hoisted(() => ({
    start: vi.fn(),
    cancelPendingAttempt: vi.fn(),
    signupNotice: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ billingSubscriptionApi: api }));

const basePlan = {
    name: 'Básico',
    amount: 1800000,
    currency: 'ARS' as const,
    cycle: 'monthly' as const
};
const props = {
    locale: 'es' as const,
    billingOptionId: '123e4567-e89b-42d3-a456-426614174000',
    accountEmail: 'account@example.test',
    plansHref: '/es/planes/',
    trialNotice: null,
    touristVipNotice: null,
    pendingAttempt: null,
    manualPaymentOnly: false
};
const promo = (chargesLeft: number | null) => ({
    codes: ['SMOKES23'],
    amount: 1440000,
    chargesLeft
});
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ');

beforeEach(() => vi.resetAllMocks());

describe('HOS-2382 checkout confirmation with a promo', () => {
    it('shows the amount that will be charged, the list price and the promo line', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={{ ...basePlan, promo: promo(3) }}
            />
        );
        const summary = screen.getByTestId('signup-checkout-plan-summary');
        expect(text(summary)).toContain('Básico · $ 14.400 por mes');
        expect(text(within(summary).getByTestId('signup-checkout-list-price'))).toBe('$ 18.000');
        expect(text(screen.getByTestId('signup-checkout-promo'))).toBe(
            'Con el código SMOKES23: $ 14.400 por mes durante 3 cobros (después $ 18.000).'
        );
    });

    it('uses the singular for one charge', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={{ ...basePlan, promo: promo(1) }}
            />
        );
        expect(text(screen.getByTestId('signup-checkout-promo'))).toContain('durante 1 cobro (');
    });

    it('omits the duration when the promo lasts forever', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={{ ...basePlan, promo: promo(null) }}
            />
        );
        expect(text(screen.getByTestId('signup-checkout-promo'))).toBe(
            'Con el código SMOKES23: $ 14.400 por mes.'
        );
    });

    it('leaves the confirmation unchanged without a promo', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={basePlan}
            />
        );
        expect(text(screen.getByTestId('signup-checkout-plan-summary'))).toBe(
            'Básico · $ 18.000 por mes'
        );
        expect(screen.queryByTestId('signup-checkout-promo')).toBeNull();
        expect(screen.queryByTestId('signup-checkout-list-price')).toBeNull();
    });

    it('shows the charged amount and the promo on a pending attempt of another option', () => {
        render(
            <SignupCheckout
                {...props}
                planSummary={null}
                pendingAttempt={{
                    subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
                    plan: { ...basePlan, promo: promo(3) },
                    checkoutUrl: 'https://payments.example/continue',
                    authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
                }}
            />
        );
        const panel = screen.getByTestId('signup-checkout-pending-attempt');
        expect(text(panel)).toContain('Básico ($ 14.400, por mes)');
        expect(text(within(panel).getByTestId('signup-checkout-promo'))).toContain('SMOKES23');
    });
});

describe('HOS-2382 notice resolvers keep the promo', () => {
    const promoPlan = { ...basePlan, promo: promo(2) };
    it('keeps the promo on the plan summary', () => {
        const summary = resolveSignupPlanSummary({
            result: { ok: true, data: { plan: promoPlan } }
        });
        expect(summary?.promo).toEqual(promo(2));
    });

    it('keeps the promo on the pending attempt plan', () => {
        const attempt = resolveSignupPendingAttempt({
            result: {
                ok: true,
                data: {
                    pendingAttempt: {
                        subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
                        plan: promoPlan,
                        checkoutUrl: null,
                        authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
                    }
                }
            }
        });
        expect(attempt?.plan.promo).toEqual(promo(2));
    });
});
