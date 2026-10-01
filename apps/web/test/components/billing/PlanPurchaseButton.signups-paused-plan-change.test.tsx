/**
 * @file PlanPurchaseButton.signups-paused-plan-change.test.tsx
 * @description The plan change of an existing subscriber is EXEMPT from the
 * admin-paused signups freeze (plan-change is not a new signup), so a card that
 * reads as a plan change keeps its "change plan" CTA while
 * `newPaidSignupsFrozen` is on. Own file because the subscription lookup is a
 * module singleton cached once per test file.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn(() => ({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    }))
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string) => fallback ?? key;
    return {
        createTranslations: (_locale: string) => ({
            t,
            tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
        }),
        createT: (_locale: string) => t
    };
});

vi.mock('../../../src/lib/billing/trial-clock', () => ({
    fetchTrialClock: () => Promise.resolve(null),
    resetTrialClockCache: () => undefined
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`,
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

beforeEach(() => {
    // The caller already pays for a DIFFERENT owner plan: this card is a plan change.
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: { subscription: { planSlug: 'owner-pro', status: 'active' } }
                    })
            })
        )
    );
});

describe('PlanPurchaseButton — plan change while signups are paused', () => {
    it('keeps the change-plan CTA for an existing subscriber (exempt from the freeze)', async () => {
        // Arrange / Act
        render(
            <PlanPurchaseButton
                planSlug="owner-basico"
                monthlyPrice={120000}
                annualPrice={1200000}
                currency="ARS"
                ctaText="Contratar"
                locale="es"
                plansPath="/es/suscriptores/planes/"
                audience="owner"
                newPaidSignupsFrozen
            />
        );

        // Assert — once the subscription lookup resolves, the card is a plan change
        expect(await screen.findByText('Cambiar a este plan')).toBeInTheDocument();
        expect(screen.queryByTestId('plan-signups-paused-notice')).not.toBeInTheDocument();
        expect(screen.getByTestId('plan-cta-button')).toBeInTheDocument();
    });
});
