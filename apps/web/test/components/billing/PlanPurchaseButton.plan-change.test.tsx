/**
 * @file PlanPurchaseButton.plan-change.test.tsx
 * @description BETA-195: an authenticated user who already has an active
 * subscription on a DIFFERENT plan must NOT fire start-paid from the pricing
 * card — the backend rejects a second subscription with a non-transitory 409.
 * The CTA relabels to "Cambiar a este plan" and routes the user to
 * Mi Suscripción → Cambiar plan (the plan-change engine) instead.
 *
 * Own file: PlanPurchaseButton's `subscriptionPromise` module-level cache is
 * set once per file and never reset between it() blocks — same rationale as the
 * trial-eligibility test files (HOS-226).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const CHANGE_PLAN_LABEL = 'Cambiar a este plan';
/** The user's current active plan — different from the card's plan below. */
const CURRENT_SUB_SLUG = 'tourist-vip';

const defaultProps = {
    // owner-basico ≠ the active tourist-vip sub → this card is a plan change.
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

/** Tracks whether the doomed start-paid checkout was ever attempted. */
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
        // Subscription lookup — the user already has an active DIFFERENT plan.
        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { subscription: { planSlug: CURRENT_SUB_SLUG } } })
        });
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    startPaidCalled = false;
    mockAuthenticated();
    vi.stubGlobal('fetch', buildFetchMock());
    // JSDOM does not allow direct href assignment in strict mode.
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

describe('PlanPurchaseButton — BETA-195 plan-change routing', () => {
    it('relabels the CTA to "Cambiar a este plan" when the user has a different active plan', async () => {
        render(<PlanPurchaseButton {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toHaveTextContent(CHANGE_PLAN_LABEL);
        });
    });

    it('routes to Mi Suscripción → Cambiar plan and never fires start-paid', async () => {
        render(<PlanPurchaseButton {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByTestId('plan-cta-button')).toHaveTextContent(CHANGE_PLAN_LABEL);
        });

        fireEvent.click(screen.getByTestId('plan-cta-button'));

        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/suscripcion/');
        });
        expect(startPaidCalled).toBe(false);
    });
});
