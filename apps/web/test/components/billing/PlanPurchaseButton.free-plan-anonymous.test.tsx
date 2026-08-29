/**
 * @file PlanPurchaseButton.free-plan-anonymous.test.tsx
 * @description HOS-917 regression: a $0 plan (e.g. `tourist-free`) must never
 * fire `createCheckout` — MercadoPago's start-paid rejects
 * `transaction_amount: 0` with a 502, a real-money incident hit in prod on
 * 2026-08-28. For an ANONYMOUS visitor the card renders a registration-funnel
 * CTA instead of the price-bearing "Empezar — $ 0" button, and clicking it
 * reuses the existing sign-in redirect path (no new redirect implementation).
 *
 * Own file: `PlanPurchaseButton`'s `subscriptionPromise` module-level cache is
 * set once per test file and never reset between `it()` blocks — same
 * rationale documented in `PlanPurchaseButton.plan-change.test.tsx`.
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

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FREE_REGISTER_LABEL = 'Registrate gratis';

/** A $0 plan — mirrors `TOURIST_FREE_PLAN` (monthlyPriceArs: 0, annualPriceArs: null). */
const freeProps = {
    planSlug: 'tourist-free',
    monthlyPrice: 0,
    annualPrice: null,
    currency: 'ARS' as const,
    ctaText: 'Empezar',
    locale: 'es' as const
};

function mockUnauthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: null,
        isPending: false
    });
}

function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUnauthenticated();
    // JSDOM does not allow direct href assignment in strict mode.
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

describe('PlanPurchaseButton — HOS-917 free plan, anonymous visitor', () => {
    it('renders the registration CTA instead of "Empezar — $ 0"', () => {
        render(<PlanPurchaseButton {...freeProps} />);

        const button = getMainButton();
        expect(button).toHaveTextContent(FREE_REGISTER_LABEL);
        expect(button).not.toHaveTextContent('$ 0');
        expect(button.getAttribute('aria-label')).toBe(FREE_REGISTER_LABEL);
    });

    it('is not disabled — the CTA must remain clickable to reach the sign-in redirect', () => {
        render(<PlanPurchaseButton {...freeProps} />);

        expect(getMainButton()).not.toBeDisabled();
    });

    it('redirects to sign-in on click, reusing the existing unauthenticated redirect path', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<PlanPurchaseButton {...freeProps} />);

        await user.click(getMainButton());

        await waitFor(() => {
            expect(window.location.href).toContain('/es/auth/signin/');
        });
        expect(window.location.href).toContain('redirect=');
        // No checkout call was ever attempted for the $0 plan.
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
