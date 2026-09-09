/**
 * @file PlanPurchaseButton.payer-email-known-lookup-throws.test.tsx
 * @description HOS-1234: a network failure on the payer-email-known lookup
 * must fail OPEN — the confirm dialog stays in place, never skipped.
 *
 * What this actually exercises, which is NOT what the filename suggests: a
 * rejected `fetch` never reaches `fetchPayerEmailKnown`'s `.catch`. `apiClient`
 * wraps every request in its own try/catch and hands back `{ ok: false }`
 * instead (see `lib/api/client.ts`), so the path under test is the `result.ok`
 * ternary — reached here through a REJECTION rather than through a non-OK
 * status like its sibling file. The `.catch` is unreachable defense in depth
 * and no test covers it; that is documented at the source, not papered over.
 *
 * Kept in its own file — see the module-singleton caching note in
 * `PlanPurchaseButton.payer-email-known-true.test.tsx`.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
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
const CHECKOUT_URL = 'https://mp.com/checkout/payer-email-known-throws';

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
            return Promise.reject(new Error('network down'));
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

describe('PlanPurchaseButton — payer-email-known lookup throws (HOS-1234)', () => {
    it('fails open — the dialog still appears', async () => {
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

        // Settle the lookup's rejection and the state update it triggers. The
        // `waitFor` above only proves the request WENT OUT — the `.catch` has
        // not run yet at that point, so clicking here would exercise the
        // initial state and the assertion below would hold no matter what the
        // catch resolves to. Measured: without this, mutating
        // `.catch(() => false)` to `.catch(() => true)` left every test green.
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        await user.click(getMainButton());

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(window.location.href).toBe('');
    });
});
