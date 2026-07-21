/**
 * @file PlanPurchaseButton.trial-eligibility-ineligible.test.tsx
 * @description HOS-226: for an authenticated user who is NOT trial-eligible
 * (already consumed their lifetime trial), the SSR-rendered "N days free"
 * badge must be corrected client-side: its text is replaced with a neutral
 * "no trial" note and it gains the `pricing-card__trial--ineligible`
 * modifier class.
 *
 * Kept in its own file — see the file-level JSDoc in
 * `PlanPurchaseButton.trial-eligibility-eligible.test.tsx` for why each
 * distinct eligibility answer needs its own test file (the component's
 * `trialEligibilityPromise` module-level cache is set once per file and
 * never reset between `it()` blocks).
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

function renderInPricingCard() {
    return render(
        <div className="pricing-card">
            <p className="pricing-card__trial">{SSR_TRIAL_TEXT}</p>
            <PlanPurchaseButton {...defaultProps} />
        </div>
    );
}

/** Dispatches by URL: eligibility endpoint (always `eligible: false` here) vs subscription lookup. */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible: false, planSlug: null } })
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
    mockAuthenticated();
    vi.stubGlobal('fetch', buildFetchMock());
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanPurchaseButton — HOS-226 badge suppression (ineligible)', () => {
    it('replaces the SSR trial badge text with the ineligible note', async () => {
        renderInPricingCard();

        await waitFor(() => {
            expect(screen.getByText(INELIGIBLE_NOTE)).toBeInTheDocument();
        });
        expect(screen.queryByText(SSR_TRIAL_TEXT)).not.toBeInTheDocument();
    });

    it('adds the pricing-card__trial--ineligible modifier class to the badge element', async () => {
        const { container } = renderInPricingCard();

        await waitFor(() => {
            const trialEl = container.querySelector('.pricing-card__trial');
            expect(trialEl).toHaveClass('pricing-card__trial--ineligible');
        });
    });
});
