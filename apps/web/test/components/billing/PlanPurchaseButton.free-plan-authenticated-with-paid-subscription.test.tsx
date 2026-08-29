/**
 * @file PlanPurchaseButton.free-plan-authenticated-with-paid-subscription.test.tsx
 * @description HOS-917: the owner-decided contract says a $0 plan card shows
 * "Ya tenés este plan" for ANY authenticated visitor — with or without a
 * subscription row — never a checkout button. This covers the case where the
 * visitor already has an active subscription on a DIFFERENT (paid) plan: the
 * `tourist-free` card must NOT relabel to "Cambiar a este plan" (the
 * BETA-195 plan-change CTA) — that CTA is only for a paid-to-paid switch, and
 * "switching" to the $0 default plan is never a purchase.
 *
 * Own file: `PlanPurchaseButton`'s `subscriptionPromise` module-level cache is
 * set once per test file and never reset between `it()` blocks — same
 * rationale documented in `PlanPurchaseButton.plan-change.test.tsx`.
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

const FREE_PLAN_LEGEND = 'Ya tenés este plan';
const CHANGE_PLAN_LABEL = 'Cambiar a este plan';
/** The user's current active plan — a paid plan, different from the $0 card below. */
const CURRENT_PAID_SUB_SLUG = 'tourist-vip';

/** A $0 plan — mirrors `TOURIST_FREE_PLAN` (monthlyPriceArs: 0, annualPriceArs: null). */
const freeProps = {
    planSlug: 'tourist-free',
    monthlyPrice: 0,
    annualPrice: null,
    currency: 'ARS' as const,
    ctaText: 'Empezar',
    locale: 'es' as const
};

function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

let startPaidCalled = false;

/** Dispatches by URL: start-paid (must never fire) vs eligibility vs subscription lookup. */
function buildFetchMock() {
    return vi.fn().mockImplementation((url: string) => {
        if (url.includes('/billing/subscriptions/start-paid')) {
            startPaidCalled = true;
            return Promise.resolve({
                ok: false,
                status: 409,
                json: () => Promise.resolve({ error: { code: 'ALREADY_EXISTS', message: 'x' } })
            });
        }
        if (url.includes('/billing/trial-eligibility')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ data: { eligible: false, planSlug: null } })
            });
        }
        // The visitor already has an active DIFFERENT (paid) subscription.
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ data: { subscription: { planSlug: CURRENT_PAID_SUB_SLUG } } })
        });
    });
}

function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

beforeEach(() => {
    vi.clearAllMocks();
    startPaidCalled = false;
    mockAuthenticated();
    vi.stubGlobal('fetch', buildFetchMock());
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

describe('PlanPurchaseButton — HOS-917 free plan, authenticated with a paid subscription elsewhere', () => {
    it('shows "Ya tenés este plan", never "Cambiar a este plan"', async () => {
        render(<PlanPurchaseButton {...freeProps} />);

        await waitFor(() => {
            expect(getMainButton()).toHaveTextContent(FREE_PLAN_LEGEND);
        });
        expect(getMainButton()).not.toHaveTextContent(CHANGE_PLAN_LABEL);
    });

    it('is disabled and never calls start-paid for the $0 plan', async () => {
        render(<PlanPurchaseButton {...freeProps} />);

        await waitFor(() => {
            expect(getMainButton()).toHaveTextContent(FREE_PLAN_LEGEND);
        });
        expect(getMainButton()).toBeDisabled();
        expect(startPaidCalled).toBe(false);
    });
});
