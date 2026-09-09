/**
 * @file PlanPurchaseButton.tourist-vip-held.test.tsx
 * @description HOS-1233 T-024 / AC-16, AC-17, AC-18 — the tourist card whose
 * benefits the visitor already holds.
 *
 * `fetchHoldsTouristVipBenefits` is deliberately NOT mocked here. Mocking it
 * would leave the whole chain this criterion actually depends on untested: that
 * the read names `?productDomain=` per vertical (an unnamed one resolves
 * accommodation and falls back to TOURIST, which would count the visitor's own
 * tourist subscription as a reason to block their tourist purchase), and that
 * the predicate compares the WIRE status spelling — the API maps `trialing` to
 * `'trial'`, so a check written against the domain enum would never match and
 * would read as "not on trial" while failing silently. Both are exercised by
 * driving the real module through `fetch`.
 *
 * `resetTouristVipStatusCache()` runs before each test because the verdict is a
 * module singleton: without it the first test's answer would be every test's
 * answer, and the AC-16 case and the AC-17 case that keeps it honest could not
 * share a file.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';
import { resetTouristVipStatusCache } from '../../../src/lib/billing/tourist-vip-status';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

const COPY: Record<string, string> = {
    'pricing.touristVipHeld.cta': 'Ya tenés estos beneficios',
    'pricing.touristVipHeld.note':
        'Tu suscripción activa ya incluye todos los beneficios VIP de turista.'
};

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => COPY[key] ?? fallback ?? key,
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`,
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

// The trial clock is not what this file is about; pin it to an elapsed trial so
// no warning dialog can interfere with the enabled/disabled assertions.
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

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HELD_NOTE = 'Tu suscripción activa ya incluye todos los beneficios VIP de turista.';
const HELD_CTA = 'Ya tenés estos beneficios';

const touristProps = {
    planSlug: 'tourist-vip',
    monthlyPrice: 1500000,
    annualPrice: null,
    currency: 'ARS' as const,
    ctaText: 'Empezar',
    locale: 'es' as const,
    plansPath: 'planes/turistas/precios',
    audience: 'tourist' as const
};

function mockAuthenticated(): void {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/**
 * Answers the three per-domain subscription reads.
 *
 * The UNSCOPED read (`fetchCurrentPlanSlug`, no `productDomain`) must answer
 * `null`, or the card would become a plan change and never reach the state
 * under test — which is also why the dispatcher keys on the query param rather
 * than on the path alone.
 *
 * @param accommodationStatus - The wire status of the visitor's accommodation
 *   subscription, or `null` when they have none.
 * @param cancelAtPeriodEnd - Whether that subscription is already scheduled to
 *   end. A soft cancel keeps reporting `status: 'active'` on the wire until
 *   `currentPeriodEnd`, so this is the only field that separates the pair.
 */
function buildFetchMock(accommodationStatus: string | null, cancelAtPeriodEnd = false) {
    return vi.fn().mockImplementation((url: string) => {
        const href = String(url);
        const scoped = href.includes('productDomain=accommodation');
        const subscription =
            scoped && accommodationStatus !== null
                ? {
                      id: 'sub-1',
                      planSlug: 'owner-basico',
                      planName: 'Básico',
                      status: accommodationStatus,
                      isComplimentary: false,
                      currentPeriodStart: null,
                      currentPeriodEnd: '2026-12-01T00:00:00.000Z',
                      cancelAtPeriodEnd,
                      trialEndsAt: null,
                      monthlyPriceArs: 1800000
                  }
                : null;
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription, eligible: true } })
        });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    resetTouristVipStatusCache();
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

describe('PlanPurchaseButton — HOS-1233 AC-16: an active subscription elsewhere blocks the tourist purchase', () => {
    it('disables the button and says the VIP benefits are already held', async () => {
        vi.stubGlobal('fetch', buildFetchMock('active'));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('tourist-vip-already-held-note')).toHaveTextContent(
                HELD_NOTE
            );
        });
        expect(screen.getByTestId('plan-cta-button')).toBeDisabled();
        expect(screen.getByText(HELD_CTA)).toBeInTheDocument();
    });

    it('asks each blocking vertical by name, never with the endpoint default', async () => {
        const fetchMock = buildFetchMock('active');
        vi.stubGlobal('fetch', fetchMock);

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('tourist-vip-already-held-note')).toBeInTheDocument();
        });

        const urls = fetchMock.mock.calls.map((call) => String(call[0]));
        expect(urls.some((url) => url.includes('productDomain=accommodation'))).toBe(true);
        expect(urls.some((url) => url.includes('productDomain=gastronomy'))).toBe(true);
        expect(urls.some((url) => url.includes('productDomain=experience'))).toBe(true);
        // The tourist's own subscription is never a reason to block them.
        expect(urls.some((url) => url.includes('productDomain=tourist'))).toBe(false);
    });
});

describe('PlanPurchaseButton — HOS-1233 AC-17/AC-18: the button stays enabled when the benefits are NOT held', () => {
    it('a trialing subscription elsewhere does not block the purchase (AC-17)', async () => {
        // The API's wire spelling for `trialing`. Deliberately excluded from
        // the holding statuses: those entitlements may be gone tomorrow, and
        // disabling this would leave the visitor no way to keep them.
        vi.stubGlobal('fetch', buildFetchMock('trial'));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toBeEnabled();
        });
        expect(screen.queryByTestId('tourist-vip-already-held-note')).toBeNull();
        expect(screen.queryByText(HELD_CTA)).toBeNull();
    });

    it('no subscription anywhere leaves the button enabled and the copy absent (AC-18)', async () => {
        vi.stubGlobal('fetch', buildFetchMock(null));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toBeEnabled();
        });
        expect(screen.queryByTestId('tourist-vip-already-held-note')).toBeNull();
    });

    it('a cancelled subscription elsewhere leaves the button enabled', async () => {
        vi.stubGlobal('fetch', buildFetchMock('cancelled'));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toBeEnabled();
        });
        expect(screen.queryByTestId('tourist-vip-already-held-note')).toBeNull();
    });

    it('a SOFT-CANCELLED subscription does not block the purchase', async () => {
        // It reports `status: 'active'` on the wire until `currentPeriodEnd`,
        // so reading the status alone disabled the button for a subscriber
        // whose benefits end on a date that is already set. That is verbatim
        // AC-17's position — holds them today, may not tomorrow — and R-7's
        // harm: a claim that becomes false on a scheduled date.
        vi.stubGlobal('fetch', buildFetchMock('active', true));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toBeEnabled();
        });
        expect(screen.queryByTestId('tourist-vip-already-held-note')).toBeNull();
        expect(screen.queryByText(HELD_CTA)).toBeNull();
    });

    it('the SAME fixture without the soft cancel DOES block it — the sibling of the above', async () => {
        // One field apart. Without this, a selector typo or a broken fetch
        // dispatcher would satisfy the negative above on its own.
        vi.stubGlobal('fetch', buildFetchMock('active', false));

        render(<PlanPurchaseButton {...touristProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('tourist-vip-already-held-note')).toHaveTextContent(
                HELD_NOTE
            );
        });
        expect(screen.getByTestId('plan-cta-button')).toBeDisabled();
    });
});

describe('PlanPurchaseButton — HOS-1233 AC-16 does not reach the host cards', () => {
    it('an owner card with the same active accommodation subscription is untouched', async () => {
        vi.stubGlobal('fetch', buildFetchMock('active'));

        render(
            <PlanPurchaseButton
                {...touristProps}
                planSlug="owner-premium"
                audience="owner"
                plansPath="planes/anfitriones/precios"
            />
        );

        // The owner card reads the same subscription and must NOT claim the
        // tourist benefits are held: this state is an ordinary plan change.
        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('tourist-vip-already-held-note')).toBeNull();
    });
});
