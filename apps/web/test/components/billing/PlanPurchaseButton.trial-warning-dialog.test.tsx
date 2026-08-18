/**
 * @file PlanPurchaseButton.trial-warning-dialog.test.tsx
 * @description Regression coverage for the MercadoPago trial-warning dialog
 * (real-money incident in prod, see `TrialWarningDialog.client.tsx`).
 *
 * MercadoPago grants its free trial once per (MercadoPago account, plan)
 * pair — a rule Hospeda's own `billingApi.getTrialEligibility()` check
 * cannot see, since that check is scoped to the Hospeda customer. Before this
 * dialog existed, a user who had already spent a trial with the same MP
 * account on this plan saw "N days free" on screen and was charged
 * immediately at checkout.
 *
 * Covers: the dialog stays out of the way for a checkout that promises no
 * trial (`trialDays === 0`, the default every other test file in this suite
 * relies on) and for a checkout the user is confirmed ineligible for; it
 * appears and BLOCKS the checkout request when a trial is genuinely
 * promised; Cancel closes it without firing checkout; Confirm closes it and
 * fires the SAME checkout the plain click would have.
 *
 * Does NOT re-test the shared `<Dialog>` primitive's focus trap / Escape /
 * focus-restore behaviour — that is already covered by
 * `test/components/Dialog.focus-trap.test.tsx` and
 * `test/components/Dialog.history-back.test.tsx`, and jsdom cannot reliably
 * assert a real focus trap regardless (see this file's own report note).
 * `<Dialog>` is used un-mocked here specifically so the dialog's real
 * `role="dialog"` and open/close wiring are exercised end to end.
 *
 * The confirmed-ineligible scenario lives in its own file
 * (`PlanPurchaseButton.trial-warning-dialog-ineligible.test.tsx`), for the
 * same reason `PlanPurchaseButton.trial-eligibility-*.test.tsx` is already
 * split by answer: `fetchTrialEligible`'s module-level `trialEligibilityPromise`
 * cache is set once per test FILE and never reset between `it()` blocks
 * within it, so a file that fetches `eligible: true` in one test and
 * `eligible: false` in another would silently keep serving the first answer.
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
const DIALOG_TITLE = 'La prueba gratis la otorga Mercado Pago';
const CONFIRM_LABEL = 'Entendido, continuar';
const CANCEL_LABEL = 'Cancelar';
const CHECKOUT_URL = 'https://mp.com/checkout/trial-warning-test';

const defaultProps = {
    planSlug: 'owner-basico',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/** Renders the button next to a stand-in for the SSR `.pricing-card__trial` badge. */
function renderInPricingCard(props: Partial<typeof defaultProps> & { trialDays?: number }) {
    return render(
        <div className="pricing-card">
            <p className="pricing-card__trial">{SSR_TRIAL_TEXT}</p>
            <PlanPurchaseButton
                {...defaultProps}
                {...props}
            />
        </div>
    );
}

/** Dispatches by URL: eligibility endpoint, checkout endpoint, and subscription lookup. */
function buildFetchMock(eligible: boolean) {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible, planSlug: null } })
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

describe('PlanPurchaseButton — trial-warning dialog gate', () => {
    it('does NOT show the dialog and goes straight to checkout when the plan has no trial (trialDays omitted / 0)', async () => {
        const fetchMock = buildFetchMock(true);
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        renderInPricingCard({});

        await user.click(getMainButton());

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).includes('/billing/subscriptions/start-paid')
            )
        ).toBe(true);
    });

    it('shows the dialog and BLOCKS the checkout request when a trial is genuinely promised', async () => {
        const fetchMock = buildFetchMock(true);
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        renderInPricingCard({ trialDays: 14 });

        await user.click(getMainButton());

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(DIALOG_TITLE);

        // The checkout request must NOT have fired yet.
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).includes('/billing/subscriptions/start-paid')
            )
        ).toBe(false);
        expect(window.location.href).toBe('');
    });

    it('Cancel closes the dialog without firing the checkout request', async () => {
        const fetchMock = buildFetchMock(true);
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        renderInPricingCard({ trialDays: 14 });

        await user.click(getMainButton());
        await screen.findByRole('dialog');

        await user.click(screen.getByRole('button', { name: CANCEL_LABEL }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).includes('/billing/subscriptions/start-paid')
            )
        ).toBe(false);
        expect(window.location.href).toBe('');
    });

    it('Confirm closes the dialog and fires the same checkout the plain click would have', async () => {
        const fetchMock = buildFetchMock(true);
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        renderInPricingCard({ trialDays: 14 });

        await user.click(getMainButton());
        await screen.findByRole('dialog');

        await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).includes('/billing/subscriptions/start-paid')
            )
        ).toBe(true);
    });
});
