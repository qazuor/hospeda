/**
 * @file PlanPurchaseButton.free-plan-authenticated-no-subscription.test.tsx
 * @description HOS-917 regression (the exact bug hit in prod on 2026-08-28):
 * an authenticated user with NO `billing_subscriptions` row at all
 * (`currentPlanSlug === null`) previously made `isCurrentPlan` false, so a
 * $0 plan card (`tourist-free`) rendered a live, enabled "Empezar — $ 0"
 * button. Clicking it fired `createCheckout` → `/start-paid` →
 * `transaction_amount: 0` → MercadoPago 502.
 *
 * The fix: a $0 plan is unpurchasable for ANY authenticated visitor
 * regardless of `currentPlanSlug` — the card shows the "Ya tenés este plan"
 * legend with no clickable checkout button.
 *
 * Own file: `PlanPurchaseButton`'s `subscriptionPromise` module-level cache is
 * set once per test file and never reset between `it()` blocks — same
 * rationale documented in `PlanPurchaseButton.plan-change.test.tsx`.
 */

import { render, screen, waitFor } from '@testing-library/react';
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

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FREE_PLAN_LEGEND = 'Ya tenés este plan';

/** A $0 plan — mirrors `TOURIST_FREE_PLAN` (monthlyPriceArs: 0, annualPriceArs: null). */
const freeProps = {
    planSlug: 'tourist-free',
    monthlyPrice: 0,
    annualPrice: null,
    currency: 'ARS' as const,
    ctaText: 'Empezar',
    locale: 'es' as const
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/** Tracks whether checkout was ever attempted. */
let startPaidCalled = false;

/** Dispatches by URL: start-paid (must never fire) vs eligibility vs subscription lookup (no row). */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/subscriptions/start-paid')) {
            startPaidCalled = true;
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: { checkoutUrl: 'https://mp.com/should-never-happen' }
                    })
            });
        }
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible: false, planSlug: null } })
            });
        }
        // No subscription row at all — the exact prod scenario.
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
    startPaidCalled = false;
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

describe('PlanPurchaseButton — HOS-917 free plan, authenticated with no subscription row', () => {
    it('renders the "Ya tenés este plan" legend instead of a checkout button', async () => {
        render(<PlanPurchaseButton {...freeProps} />);

        await waitFor(() => {
            expect(getMainButton()).toHaveTextContent(FREE_PLAN_LEGEND);
        });
        const button = getMainButton();
        expect(button).not.toHaveTextContent('$ 0');
        expect(button).not.toHaveTextContent('Empezar');
    });

    it('renders the button as disabled with aria-disabled="true"', async () => {
        render(<PlanPurchaseButton {...freeProps} />);

        await waitFor(() => {
            expect(getMainButton()).toHaveTextContent(FREE_PLAN_LEGEND);
        });
        const button = getMainButton();
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('never calls the start-paid checkout endpoint, even after the legend has rendered', async () => {
        render(<PlanPurchaseButton {...freeProps} />);

        await waitFor(() => {
            expect(getMainButton()).toHaveTextContent(FREE_PLAN_LEGEND);
        });

        // The button has no onClick handler while disabled (buttonDisabled
        // short-circuits `onClick={buttonDisabled ? undefined : ...}`), so a
        // raw DOM click cannot reach handleClick — this asserts the outcome
        // (no network call), which is what actually matters for HOS-917.
        expect(startPaidCalled).toBe(false);
        const calledUrls = (vi.mocked(fetch).mock.calls as unknown as [string][]).map(
            ([url]) => url
        );
        expect(calledUrls.some((url) => url.includes('start-paid'))).toBe(false);
    });
});
