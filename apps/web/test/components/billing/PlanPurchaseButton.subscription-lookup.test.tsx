/**
 * @file PlanPurchaseButton.subscription-lookup.test.tsx
 * @description HOS-1321 item 1: `fetchCurrentPlanSlug` must keep asking
 * `GET /protected/users/me/subscription` WITHOUT a `productDomain`.
 *
 * The endpoint treats "no `?productDomain=`" and "`?productDomain=accommodation`"
 * as two different questions (HOS-1233): only the unqualified one resolves
 * accommodation first and then falls back to tourist. Naming a domain here
 * makes the read strict, so a `tourist-vip` holder comes back `null`, reads as
 * "no subscription", gets a fresh "Contratar" and fires a `/start-paid` that
 * HOS-1260 deterministically refuses — the dead end this issue exists to close.
 *
 * The scoped reads that DO name a domain are a different question with a
 * different failure direction and live in `lib/billing/tourist-vip-status.ts`;
 * the tourist case below asserts the two coexist rather than replace each other.
 *
 * Own file: `subscriptionPromise` is a module-level singleton set once per test
 * FILE and never reset between `it()` blocks, like every sibling here.
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

vi.mock('../../../src/lib/i18n', () => {
    const t = (_key: string, fallback?: string) => fallback ?? _key;
    return {
        createTranslations: (_locale: string) => ({
            t,
            tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
        }),
        createT: (_locale: string) => t
    };
});

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
    },
    buildUrlWithParams: ({ locale, path = '' }: { locale: string; path?: string }) =>
        `/${locale}/${path}/`
}));

vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

import { useSession } from '../../../src/lib/auth-client';

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The "you already hold this" state — proof the subscription was actually seen. */
const CURRENT_PLAN_LABEL = 'Plan actual';

const SUBSCRIPTION_PATH = '/users/me/subscription';

const baseProps = {
    // Overridden per render — the visitor below pays for `tourist-vip`.
    planSlug: 'owner-basico',
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const,
    ownPreapprovalEnabled: true
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

const TOURIST_VIP_SUBSCRIPTION = {
    id: 'sub-tourist',
    planSlug: 'tourist-vip',
    planName: 'Turista VIP',
    status: 'active',
    isComplimentary: false,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    courtesyEndsAt: null,
    monthlyPriceArs: 1500000,
    scheduledPlanChange: null
};

/**
 * Mirrors the endpoint's own HOS-1233 semantics: an UNQUALIFIED read resolves
 * the tourist subscription through the ordered fallback, a read that NAMES a
 * domain stays strict and finds nothing for a tourist row.
 *
 * That asymmetry is the whole point — without it the mock could not tell the
 * unqualified call from a scoped one, and neither could this test.
 */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/payer-email-known')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { hasKnownPayerEmail: true } })
            });
        }
        if (url.includes(SUBSCRIPTION_PATH)) {
            const namesADomain = url.includes('productDomain=');
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: { subscription: namesADomain ? null : TOURIST_VIP_SUBSCRIPTION }
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

/** Every `/users/me/subscription` URL the component requested. */
function subscriptionCalls(fetchMock: ReturnType<typeof vi.fn>): string[] {
    return fetchMock.mock.calls
        .map((call) => String(call[0]))
        .filter((url) => url.includes(SUBSCRIPTION_PATH));
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

describe('PlanPurchaseButton — the current-plan lookup stays unqualified (HOS-1321)', () => {
    // ONE test, not two: `subscriptionPromise` is resolved once per file, so a
    // second render observes no second request and could assert nothing about
    // it. The tourist audience is the one that exercises both reads at once —
    // the unqualified current-plan lookup AND `fetchHoldsTouristVipBenefits`,
    // which names accommodation, gastronomy and experience on purpose (its
    // fallback would count a traveller's own subscription as a reason to
    // disable their own purchase). The owner-audience half of the same
    // behaviour — a tourist-vip holder relabelling an owner card to
    // "Cambiar a este plan" — is covered by
    // `PlanPurchaseButton.plan-change.test.tsx`.
    it('reads the subscription with NO productDomain, alongside the domain-scoped VIP reads', async () => {
        // Arrange
        mockAuthenticated();
        const fetchMock = buildFetchMock();
        vi.stubGlobal('fetch', fetchMock);

        // Act
        render(
            <PlanPurchaseButton
                {...baseProps}
                planSlug="tourist-vip"
                audience="tourist"
            />
        );

        // Assert — the scoped VIP reads happened...
        await waitFor(() => {
            expect(subscriptionCalls(fetchMock).some((url) => url.includes('productDomain='))).toBe(
                true
            );
        });
        // ...and the current-plan read named no domain. This is the assertion
        // that fails if anyone "fixes" `fetchCurrentPlanSlug` by passing one.
        expect(subscriptionCalls(fetchMock).some((url) => !url.includes('productDomain='))).toBe(
            true
        );

        // Assert — and the answer reached the UI: the traveller's own tier is
        // recognised as the plan they already hold, never as a fresh purchase.
        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toHaveTextContent(CURRENT_PLAN_LABEL);
        });
    });
});
