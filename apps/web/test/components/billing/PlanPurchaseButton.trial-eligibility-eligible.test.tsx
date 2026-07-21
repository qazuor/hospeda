/**
 * @file PlanPurchaseButton.trial-eligibility-eligible.test.tsx
 * @description HOS-226: the SSR-rendered "N days free" trial badge must
 * stay untouched (a) for an anonymous visitor (no eligibility lookup is
 * even attempted — the Pricing Exception, see apps/web/CLAUDE.md, requires
 * the pricing page to never be auth-dependent at SSR) and (b) for an
 * authenticated visitor who IS still trial-eligible.
 *
 * Kept in its own file, separate from the "ineligible" and "lookup failure"
 * scenarios: `PlanPurchaseButton`'s trial-eligibility fetch is cached in a
 * module-level singleton (`trialEligibilityPromise`, mirroring the
 * pre-existing `subscriptionPromise` pattern) that is set once per test
 * FILE module instance and never reset between `it()` blocks within a
 * file. Splitting by expected eligibility answer keeps every test in a
 * file consistent with the one real fetch that ever fires in it — Vitest
 * already isolates module state PER FILE, so this needs no extra
 * `resetModules` machinery.
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

const SSR_TRIAL_TEXT = '14 días gratis';
const INELIGIBLE_NOTE = 'Sin período de prueba';

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

function mockUnauthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: null,
        isPending: false
    });
}

/** Renders the button next to a stand-in for the SSR `.pricing-card__trial` badge. */
function renderInPricingCard() {
    return render(
        <div className="pricing-card">
            <p className="pricing-card__trial">{SSR_TRIAL_TEXT}</p>
            <PlanPurchaseButton {...defaultProps} />
        </div>
    );
}

/** Dispatches by URL: eligibility endpoint vs the subscription lookup. */
function buildFetchMock(eligible: boolean) {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible, planSlug: null } })
            });
        }
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: null } })
        });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanPurchaseButton — HOS-226 badge stays untouched (anonymous / eligible)', () => {
    it('keeps the SSR trial badge for an anonymous visitor and never calls the eligibility endpoint', async () => {
        mockUnauthenticated();
        const fetchMock = buildFetchMock(false);
        vi.stubGlobal('fetch', fetchMock);

        renderInPricingCard();

        await waitFor(() => {
            expect(screen.getByText(SSR_TRIAL_TEXT)).toBeInTheDocument();
        });
        expect(screen.queryByText(INELIGIBLE_NOTE)).not.toBeInTheDocument();

        const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
        expect(calledUrls.some((url) => url.includes('/billing/trial-eligibility'))).toBe(false);
    });

    it('keeps the SSR trial badge for an authenticated user who is still trial-eligible', async () => {
        mockAuthenticated();
        vi.stubGlobal('fetch', buildFetchMock(true));

        renderInPricingCard();

        await waitFor(() => {
            expect(screen.getByText(SSR_TRIAL_TEXT)).toBeInTheDocument();
        });
        expect(screen.queryByText(INELIGIBLE_NOTE)).not.toBeInTheDocument();
    });
});
