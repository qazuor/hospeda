/**
 * @file PlanPurchaseButton.own-preapproval-gate.test.tsx
 * @description Regression coverage for the `ownPreapprovalEnabled` gate on
 * the payer-email confirm dialog (HOS-937 review fix, widened in step 4).
 *
 * The dialog (`PayerEmailConfirmDialog`) only has an effect on the
 * own-preapproval checkout path — the ONLY path that binds `payer_email`
 * server-side. On every other path (this flag off, which is production
 * today) MercadoPago's hosted share-link checkout silently discards
 * `payer_email`, so the dialog would be an extra click in a flow that bills,
 * with zero effect.
 *
 * Before this gate, `setShowPayerEmailConfirm(true)` fired unconditionally —
 * every authenticated checkout saw the dialog regardless of the flag. This
 * file is the regression test for that bug: prop omitted / `false` (the
 * flag's own dark-by-default posture and today's production value) must
 * render the pre-HOS-937 checkout flow byte for byte, and `true` must show
 * the dialog for BOTH intervals this button renders (monthly and annual) —
 * since HOS-937 step 4 extended the own-preapproval path (and the SAME
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` flag) to accommodation annual
 * too, so a gate still restricted to monthly would let an annual checkout
 * bind a payer_email the user never saw or could edit.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

// ---------------------------------------------------------------------------
// Module mocks (mirrors PlanPurchaseButton.test.tsx)
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
const CHECKOUT_URL = 'https://mp.com/checkout/gate-test';

const defaultProps = {
    planSlug: 'plan_starter',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    audience: 'owner' as const
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: SESSION_EMAIL } },
        isPending: false
    });
}

function buildFetchMock() {
    return vi.fn().mockResolvedValue({
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

function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

/**
 * Number of calls `fetchMock` received for the actual checkout POST
 * (`/subscriptions/start-paid`).
 *
 * HOS-1234: this file's earlier assertions counted `fetchMock`'s TOTAL call
 * count, which held only because no other authenticated effect happened to
 * call `fetch` before the dialog gate. That is no longer true — the new
 * `hasKnownPayerEmail` lookup (module-cached exactly like
 * `trialEligibilityPromise`/`subscriptionPromise`) also fires once
 * `ownPreapprovalEnabled` first goes `true` in this file, on mount, before
 * any click. Filtering by URL keeps these assertions meaningful (checkout
 * really did/did not fire) instead of coupling them to how many *other*
 * background lookups happen to run first.
 */
function countCheckoutCalls(fetchMock: ReturnType<typeof vi.fn>): number {
    return fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/billing/subscriptions/start-paid')
    ).length;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticated();
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

describe('PlanPurchaseButton — own-preapproval gate (HOS-937 review fix)', () => {
    it('flag OFF (prop omitted): clicking the CTA skips the dialog entirely and goes straight to checkout with the session email', async () => {
        // Arrange — `ownPreapprovalEnabled` intentionally NOT passed, matching
        // every real caller today (the SSR fetch defaults to `false` on any
        // error, and production has the underlying env flag off).
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<PlanPurchaseButton {...defaultProps} />);

        // Act
        await user.click(getMainButton());

        // Assert — no dialog ever renders; the checkout POST fires immediately
        // and the redirect happens with no manual confirm step. If the gate
        // regresses to "always show", this assertion times out instead of
        // passing, because runCheckout never fires without a Continue click.
        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // The subscription-lookup GET (`userApi.getSubscription()`) also fires
        // on mount and shares this mock — filter to the checkout POST by URL,
        // same as the trial-warning-dialog test file does.
        const checkoutCall = fetchMock.mock.calls.find((call) =>
            String(call[0]).includes('/billing/subscriptions/start-paid')
        ) as [string, RequestInit];
        const body = JSON.parse(checkoutCall[1].body as string) as { payerEmail: string };
        expect(body.payerEmail).toBe(SESSION_EMAIL);
    });

    it('flag OFF explicit (`ownPreapprovalEnabled={false}`): same direct-checkout behavior', async () => {
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...defaultProps}
                ownPreapprovalEnabled={false}
            />
        );

        await user.click(getMainButton());

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('flag ON + monthly interval (default): clicking the CTA opens the dialog and BLOCKS checkout until confirmed', async () => {
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(
            <PlanPurchaseButton
                {...defaultProps}
                ownPreapprovalEnabled={true}
            />
        );

        // Act
        await user.click(getMainButton());

        // Assert — dialog appears, checkout has NOT fired yet.
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(countCheckoutCalls(fetchMock)).toBe(0);
        expect(window.location.href).toBe('');

        // Confirm — checkout fires with the pre-filled session email.
        await user.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(countCheckoutCalls(fetchMock)).toBe(1);
    });

    it('flag ON + annual interval: the dialog STILL appears — HOS-937 step 4 extended own-preapproval to annual too', async () => {
        // Arrange — wrapping in a [data-billing="annual"] ancestor makes the
        // island resolve billingInterval to 'annual' on mount, mirroring how
        // the real annual toggle works. This is the exact regression the
        // step-4 widening fixes: before it, an annual checkout with the flag
        // on created a binding own-preapproval but never showed this dialog.
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(
            <div data-billing="annual">
                <PlanPurchaseButton
                    {...defaultProps}
                    ownPreapprovalEnabled={true}
                />
            </div>
        );

        await waitFor(() => {
            expect(getMainButton()).toBeInTheDocument();
        });

        // Act
        await user.click(getMainButton());

        // Assert — dialog appears, checkout has NOT fired yet.
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(countCheckoutCalls(fetchMock)).toBe(0);
        expect(window.location.href).toBe('');

        // Confirm — checkout fires with the pre-filled session email.
        await user.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(countCheckoutCalls(fetchMock)).toBe(1);
    });
});
