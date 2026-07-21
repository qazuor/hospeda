/**
 * @file PlanPurchaseButton.trial-eligibility-lookup-non-ok.test.tsx
 * @description HOS-226: when the trial-eligibility lookup itself returns a
 * non-ok HTTP response (e.g. a 500), the SSR-rendered "N days free" badge
 * must stay untouched — the fail-safe default (`trialEligible: null`)
 * never triggers suppression, only an explicit `eligible: false` does.
 *
 * Kept in its own file — see the file-level JSDoc in
 * `PlanPurchaseButton.trial-eligibility-eligible.test.tsx` for why each
 * distinct fetch-mock scenario needs its own test file (the component's
 * `trialEligibilityPromise` module-level cache is set once per file).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

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

/** Eligibility endpoint returns a 500; subscription lookup succeeds normally. */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Internal server error' })
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

describe('PlanPurchaseButton — HOS-226 badge stays untouched on lookup failure (non-ok response)', () => {
    it('keeps the SSR trial badge when the eligibility endpoint returns a non-ok response', async () => {
        renderInPricingCard();

        await waitFor(() => {
            expect(screen.getByText(SSR_TRIAL_TEXT)).toBeInTheDocument();
        });
        expect(screen.queryByText(INELIGIBLE_NOTE)).not.toBeInTheDocument();
    });
});
