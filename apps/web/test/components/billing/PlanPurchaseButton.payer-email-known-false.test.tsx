/**
 * @file PlanPurchaseButton.payer-email-known-false.test.tsx
 * @description HOS-1234: `hasKnownPayerEmail: false` (no cached MercadoPago
 * payer email on file) must leave the pre-redirect payer-email confirm
 * dialog in place — checkout only fires after the user confirms.
 *
 * Kept in its own file — see the module-singleton caching note in
 * `PlanPurchaseButton.payer-email-known-true.test.tsx`.
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

// HOS-1233: this file's account already BURNED its accommodation trial, so the
// new trial gate in `handleClick` is a no-op here and the checkout path these
// tests were written for is what they still exercise. Mocked at the module
// boundary rather than through `fetch` because `fetchTrialClock` caches its
// answer in a module singleton — one throwing fetch in the first test would
// otherwise leave every later test reading an UNRESOLVED clock, which warns.
vi.mock('../../../src/lib/billing/trial-clock', () => ({
    fetchTrialClock: () =>
        Promise.resolve({
            isOnTrial: false,
            isExpired: true,
            daysRemaining: null,
            startedAt: '2026-01-01T00:00:00.000Z'
        }),
    resetTrialClockCache: () => undefined
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
const CHECKOUT_URL = 'https://mp.com/checkout/payer-email-known-false';

const defaultProps = {
    planSlug: 'plan_starter',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    audience: 'owner' as const,
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
                json: () => Promise.resolve({ data: { hasKnownPayerEmail: false } })
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

describe('PlanPurchaseButton — payer-email-known: false (HOS-1234)', () => {
    it('the dialog still appears and blocks checkout until confirmed', async () => {
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

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(window.location.href).toBe('');

        await user.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
    });
});
