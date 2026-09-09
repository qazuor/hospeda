/**
 * @file PlanPurchaseButton.trial-branches.test.tsx
 * @description HOS-1233 T-024 / AC-3, AC-4, AC-5, AC-9 — what "Empezar" does
 * once it consults the trial.
 *
 * Almost every assertion here is about an ABSENCE — no dialog, no checkout, no
 * navigation — which is the shape that passes for the wrong reason most easily
 * (§9). So each absence has a POSITIVE sibling in this same file asserting the
 * identical selector fires in the opposite state: the "no dialog" cases sit
 * next to a case where `screen.queryByRole('dialog')` is non-null, and the "no
 * checkout" cases next to one where `/start-paid` is called. A selector typo
 * therefore fails the positive test instead of silently passing the negative
 * one.
 *
 * `fetchTrialClock` is mocked at the module boundary rather than through
 * `fetch`, for one measured reason: it caches its answer in a module singleton
 * that Vitest isolates per FILE, not per `it()`. Driving it through `fetch`
 * would give every test in this file whichever clock the first one happened to
 * resolve — and this file needs four different clocks.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';
import type { TrialClockReading } from '../../../src/lib/billing/trial-start-branch';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

/**
 * A dictionary rather than `key => key`: AC-4 requires the dialog to name the
 * NUMBER of days, so the mock has to interpolate `{{count}}` for that assertion
 * to mean anything. Only the keys this file reads are listed; anything else
 * falls back to the key, which is loud enough to spot in a failure diff.
 */
const COPY: Record<string, string> = {
    'pricing.trialWarning.title': 'Vas a perder tu prueba gratis',
    'pricing.trialWarning.bodyUnknown':
        'Puede que tengas una prueba gratis en curso. Si contratás ahora, la perdés.',
    'pricing.trialWarning.immediateCharge':
        'El cobro es inmediato: se hace ahora, no al terminar la prueba.',
    'pricing.trialWarning.confirm': 'Contratar igual',
    'pricing.trialWarning.cancel': 'Seguir con la prueba'
};

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => COPY[key] ?? fallback ?? key,
        tPlural: (key: string, count: number) =>
            key === 'pricing.trialWarning.body'
                ? `Te quedan ${count} días de prueba gratis. Si contratás ahora, los perdés.`
                : `${key}:${count}`
    })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    },
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

const fetchTrialClockMock = vi.fn<() => Promise<TrialClockReading | null>>();

vi.mock('../../../src/lib/billing/trial-clock', () => ({
    fetchTrialClock: () => fetchTrialClockMock(),
    resetTrialClockCache: () => undefined
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHECKOUT_URL = 'https://mp.com/checkout/paid';

const ownerProps = {
    planSlug: 'owner-basico',
    monthlyPrice: 1800000,
    annualPrice: 18000000,
    currency: 'ARS' as const,
    ctaText: 'Empezar',
    locale: 'es' as const,
    plansPath: 'planes/anfitriones/precios',
    audience: 'owner' as const
};

/** A trial that has never started — D-2's first branch. */
const NEVER_STARTED: TrialClockReading = {
    isOnTrial: false,
    isExpired: false,
    daysRemaining: null,
    startedAt: null
};

/** A trial running with plenty of days left — D-2's second branch. */
const RUNNING_WITH_DAYS: TrialClockReading = {
    isOnTrial: true,
    isExpired: false,
    daysRemaining: 12,
    startedAt: '2026-09-01T00:00:00.000Z'
};

/** A trial down to its last day — D-2's third branch. */
const RUNNING_ALMOST_OVER: TrialClockReading = {
    isOnTrial: true,
    isExpired: false,
    daysRemaining: 1,
    startedAt: '2026-08-11T00:00:00.000Z'
};

function mockAuthenticated(): void {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/**
 * Dispatches by URL: the subscription lookup (no subscription, so the button is
 * a fresh checkout rather than a plan change) and `/start-paid`.
 */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (String(url).includes('/start-paid')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: {
                            checkoutUrl: CHECKOUT_URL,
                            localSubscriptionId: 'sub-1',
                            appliedEffect: null,
                            promoCodeIgnored: false
                        }
                    })
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null, eligible: true } })
        });
    });
}

function startPaidCalls(fetchMock: ReturnType<typeof buildFetchMock>): string[] {
    return fetchMock.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => url.includes('/start-paid'));
}

/** Renders the button and waits for the trial clock to have been consulted. */
async function renderAndSettle() {
    render(<PlanPurchaseButton {...ownerProps} />);
    await waitFor(() => {
        expect(fetchTrialClockMock).toHaveBeenCalled();
    });
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

describe('PlanPurchaseButton — HOS-1233 AC-3: an unstarted trial goes to the create form', () => {
    it('navigates to /publicar/ and opens NO dialog', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(NEVER_STARTED);

        const button = await renderAndSettle();
        await user.click(button);

        expect(window.location.href).toBe('/es/publicar/');
        // AC-3 in full: no payer-email dialog either. The sibling that keeps
        // this honest is the AC-4 suite below, where the same query DOES find
        // a dialog.
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(startPaidCalls(fetchMock)).toEqual([]);
    });
});

describe('PlanPurchaseButton — HOS-1233: an audience with no create form falls through to checkout', () => {
    it('a traveller whose trial never started goes to checkout, not to a create form', async () => {
        // D-2's first branch says "step 1 of that vertical's create form", and
        // a traveller has no listing to create — `tourist` maps to `null` in
        // `resolvePublishPathForPricingAudience`. Falling through to checkout
        // is what the page already did and promises nothing; the alternative
        // is a button that does nothing at all.
        //
        // FLAGGED FOR THE OWNER: this is the one behaviour in HOS-1233 that
        // D-2 does not spell out. If a traveller with an unstarted trial should
        // instead be warned, or sent somewhere else, this test is what changes.
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(NEVER_STARTED);

        render(
            <PlanPurchaseButton
                {...ownerProps}
                planSlug="tourist-vip"
                audience="tourist"
                plansPath="planes/turistas/precios"
            />
        );
        await waitFor(() => {
            expect(fetchTrialClockMock).toHaveBeenCalled();
        });
        await user.click(screen.getByTestId('plan-cta-button'));

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(startPaidCalls(fetchMock)).toHaveLength(1);
    });
});

describe('PlanPurchaseButton — HOS-1233 AC-4: more days left than the threshold warns first', () => {
    it('opens a dialog naming the number of days and the immediate charge', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(RUNNING_WITH_DAYS);

        const button = await renderAndSettle();
        await user.click(button);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('trial-warning-days')).toHaveTextContent('12');
        expect(
            screen.getByText('El cobro es inmediato: se hace ahora, no al terminar la prueba.')
        ).toBeInTheDocument();
        // The warning is a QUESTION: nothing may have been charged yet.
        expect(startPaidCalls(fetchMock)).toEqual([]);
        expect(window.location.href).toBe('');
    });

    it('cancelling performs no checkout and leaves the subscription untouched', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(RUNNING_WITH_DAYS);

        const button = await renderAndSettle();
        await user.click(button);
        await screen.findByRole('dialog');
        await user.click(screen.getByTestId('trial-warning-cancel'));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).toBeNull();
        });
        expect(startPaidCalls(fetchMock)).toEqual([]);
        expect(window.location.href).toBe('');
    });

    it('confirming proceeds to checkout — the positive sibling of the two above', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(RUNNING_WITH_DAYS);

        const button = await renderAndSettle();
        await user.click(button);
        await screen.findByRole('dialog');
        await user.click(screen.getByTestId('trial-warning-confirm'));

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(startPaidCalls(fetchMock)).toHaveLength(1);
    });
});

describe('PlanPurchaseButton — HOS-1233 AC-5: at or under the threshold goes straight to checkout', () => {
    it('opens no warning and follows the checkout URL', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(RUNNING_ALMOST_OVER);

        const button = await renderAndSettle();
        await user.click(button);

        await waitFor(() => {
            expect(window.location.href).toBe(CHECKOUT_URL);
        });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(startPaidCalls(fetchMock)).toHaveLength(1);
    });
});

describe('PlanPurchaseButton — HOS-1233 AC-9: an unresolved clock warns rather than charging', () => {
    it('opens the dialog with no day count when the read failed', async () => {
        const user = userEvent.setup();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);
        fetchTrialClockMock.mockResolvedValue(null);

        const button = await renderAndSettle();
        await user.click(button);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        // No figure is invented, and above all no "0 días" (F-9).
        expect(screen.getByTestId('trial-warning-days')).toHaveTextContent(
            'Puede que tengas una prueba gratis en curso. Si contratás ahora, la perdés.'
        );
        expect(startPaidCalls(fetchMock)).toEqual([]);
    });
});
