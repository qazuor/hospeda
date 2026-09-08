/**
 * @file PlanPurchaseButton.payer-email-known-true.test.tsx
 * @description HOS-1234: `hasKnownPayerEmail: true` must skip the
 * pre-redirect payer-email confirm dialog entirely and go straight to
 * checkout, WITHOUT forcing `payerEmail` in the `/start-paid` request body —
 * omitting it lets the server resolve it from the same
 * `billing_customers.mp_payer_email` cache this lookup just confirmed
 * exists. Forcing the session email here instead would silently override a
 * legitimately different cached address (HOS-971's whole point).
 *
 * Kept in its own file: `PlanPurchaseButton`'s payer-email-known fetch is
 * cached in a module-level singleton (`payerEmailKnownPromise`, mirroring
 * the pre-existing `trialEligibilityPromise` pattern) that is set once per
 * test FILE module instance and never reset between `it()` blocks within a
 * file — so every distinct lookup OUTCOME needs its own file, exactly like
 * the sibling `PlanPurchaseButton.trial-eligibility-*.test.tsx` files.
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

const SESSION_EMAIL = 'juan@example.com';
const CHECKOUT_URL = 'https://mp.com/checkout/payer-email-known-true';

const defaultProps = {
    planSlug: 'plan_starter',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    ownPreapprovalEnabled: true
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: SESSION_EMAIL } },
        isPending: false
    });
}

function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/payer-email-known')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { hasKnownPayerEmail: true } })
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
                            expiresAt: null,
                            appliedEffect: null,
                            promoCodeIgnored: false,
                            localSubscriptionId: 'sub-1'
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

describe('PlanPurchaseButton — payer-email-known: true (HOS-1234)', () => {
    it('skips the dialog, checkout fires directly, and payerEmail is omitted from the request body', async () => {
        mockAuthenticated();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<PlanPurchaseButton {...defaultProps} />);

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some((call) =>
                    String(call[0]).includes('/billing/payer-email-known')
                )
            ).toBe(true);
        });

        await user.click(getMainButton());

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const checkoutCall = fetchMock.mock.calls.find((call) =>
            String(call[0]).includes('/billing/subscriptions/start-paid')
        ) as [string, RequestInit];
        const body = JSON.parse(checkoutCall[1].body as string) as Record<string, unknown>;
        expect(body).not.toHaveProperty('payerEmail');
    });
});
