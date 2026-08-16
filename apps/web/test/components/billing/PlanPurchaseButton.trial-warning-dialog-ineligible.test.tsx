/**
 * @file PlanPurchaseButton.trial-warning-dialog-ineligible.test.tsx
 * @description The trial-warning dialog (see `TrialWarningDialog.client.tsx`
 * and `PlanPurchaseButton.trial-warning-dialog.test.tsx` for the full
 * rationale) must NOT appear when the user is a confirmed trial-ineligible
 * — warning about a trial that will not be offered anyway is noise, and the
 * SSR "N days free" badge is already being replaced with the neutral
 * "no trial" note for the same reason.
 *
 * Kept in its own file — see the file-level JSDoc in
 * `PlanPurchaseButton.trial-eligibility-eligible.test.tsx` and
 * `PlanPurchaseButton.trial-warning-dialog.test.tsx` for why each distinct
 * eligibility answer needs its own test file (the component's
 * `trialEligibilityPromise` module-level cache is set once per test FILE and
 * never reset between `it()` blocks).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    }
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/billing/TrialWarningDialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SSR_TRIAL_TEXT = '14 días gratis';
const INELIGIBLE_NOTE = 'Sin período de prueba';
const CHECKOUT_URL = 'https://mp.com/checkout/trial-warning-ineligible-test';

const defaultProps = {
    planSlug: 'owner-basico',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    trialDays: 14
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

function renderInPricingCard() {
    return render(
        <div className="pricing-card">
            <p className="pricing-card__trial">{SSR_TRIAL_TEXT}</p>
            <PlanPurchaseButton {...defaultProps} />
        </div>
    );
}

/** Dispatches by URL: eligibility endpoint (always `eligible: false` here), checkout, and subscription lookup. */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible: false, planSlug: null } })
            });
        }
        if (url.includes('/billing/subscriptions/start-paid')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: {
                            checkoutUrl: CHECKOUT_URL,
                            orderId: 'order-1',
                            amount: 120000,
                            currency: 'ARS',
                            expiresAt: null
                        }
                    })
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null } })
        });
    });
}

function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticated();
    vi.stubGlobal('fetch', buildFetchMock());
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanPurchaseButton — trial-warning dialog gate (confirmed ineligible)', () => {
    it('does NOT show the dialog and goes straight to checkout when the user is confirmed trial-ineligible', async () => {
        const user = userEvent.setup();
        renderInPricingCard();

        // Wait for the eligibility lookup to resolve (mirrors the ineligible
        // badge-suppression test file) before clicking, so `trialEligible` is
        // confirmed `false` rather than still `null`.
        await waitFor(() => {
            expect(screen.getByText(INELIGIBLE_NOTE)).toBeInTheDocument();
        });

        await user.click(getMainButton());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
    });
});
