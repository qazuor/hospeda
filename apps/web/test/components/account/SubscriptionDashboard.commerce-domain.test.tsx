/**
 * @file SubscriptionDashboard.commerce-domain.test.tsx
 * @description Regression tests for which plan-change flow the dashboard offers
 * per product domain (HOS-1213).
 *
 * ## The bug these reproduce
 *
 * `mi-cuenta/suscripcion/index.astro` resolved `productDomain` and then fetched
 * the plan catalogue with NO `?domain=`, so the endpoint served its
 * `accommodation` default for all three dashboards. The category was then picked
 * by ROLE, and a commerce owner has no accommodation nav access, so it resolved
 * to `'tourist'`. Measured on staging: the "Cambiar plan" dialog of a $30.000
 * gastronomy subscription offered `tourist-free` ($0) and `tourist-vip`
 * ($15.000), both labelled «MEJORA».
 *
 * The page-side half of the fix (fetching with `?domain=`) is asserted by
 * `test/pages/subscription-page-plan-domain.guard.test.ts`. This file covers the
 * component half: the dashboard must offer the COMMERCE flow for a commerce
 * vertical and the accommodation one only for accommodation.
 *
 * `CommercePlanChange` is substituted by a double that renders the props it was
 * handed. Its own behaviour has its own suite (`CommercePlanChange.test.tsx`);
 * what changed here is the WIRING, so the double is what the assertions are
 * actually about — and rendering the received plan slugs keeps "no tourist plan
 * is offered" an assertion over the DOM rather than over a mock call record.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SubscriptionDashboard,
    type SubscriptionDashboardUser
} from '../../../src/components/account/SubscriptionDashboard.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/SubscriptionDashboard.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/PlanChangeFlow.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/PlanPicker.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

vi.mock('../../../src/components/account/DowngradePreviewPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, p) => String(p) })
}));

/**
 * The double. Renders the vertical it was given plus every plan slug, so the
 * assertions below read the DOM the owner would see rather than a spy's
 * arguments.
 */
vi.mock('../../../src/components/commerce/CommercePlanChange.client', () => ({
    CommercePlanChange: (props: {
        vertical: string;
        currentPlanSlug: string;
        plans: readonly { slug: string }[];
    }) => (
        <div data-testid="commerce-plan-change">
            <span data-testid="commerce-vertical">{props.vertical}</span>
            <span data-testid="commerce-current-plan">{props.currentPlanSlug}</span>
            <span data-testid="commerce-offered-plans">
                {props.plans.map((plan) => plan.slug).join(',')}
            </span>
        </div>
    )
}));

vi.mock('@repo/icons', () => ({
    CheckIcon: () => <span data-testid="icon-check" />,
    ArrowRightIcon: () => <span data-testid="icon-arrow-right" />,
    DownloadIcon: () => <span data-testid="icon-download" />,
    CancelIcon: () => <span data-testid="icon-cancel" />,
    PlayIcon: () => <span data-testid="icon-play" />,
    PowerOffIcon: () => <span data-testid="icon-power-off" />,
    CreditCardIcon: () => <span data-testid="icon-credit-card" />
}));

vi.mock('../../../src/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

vi.mock('@/lib/env', () => ({
    getAdminUrl: vi.fn().mockReturnValue('http://localhost:3000'),
    getApiUrl: vi.fn().mockReturnValue('http://localhost:3001')
}));

const mockGetSubscription = vi.fn();
const mockListInvoices = vi.fn();

// Both factories are written out inline rather than sharing a top-level helper:
// `vi.mock` is hoisted above every top-level binding, so referencing one throws
// `Cannot access '<name>' before initialization` at collection time.
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: { getSubscription: () => mockGetSubscription() },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: vi.fn(),
        pauseSubscription: vi.fn(),
        resumeSubscription: vi.fn(),
        changePlan: vi.fn(),
        previewDowngrade: vi.fn(),
        replacePaymentMethod: vi.fn()
    }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    userApi: { getSubscription: () => mockGetSubscription() },
    billingApi: {
        listInvoices: () => mockListInvoices(),
        cancelSubscription: vi.fn(),
        pauseSubscription: vi.fn(),
        resumeSubscription: vi.fn(),
        changePlan: vi.fn(),
        previewDowngrade: vi.fn(),
        replacePaymentMethod: vi.fn()
    }
}));

vi.mock('../../../src/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A gastronomy owner. Deliberately holds NO `HOST` role — that is exactly what
 * made the old role-based category lookup resolve to `'tourist'`.
 */
const COMMERCE_OWNER: SubscriptionDashboardUser = {
    id: 'user-commerce-1',
    roles: ['USER', 'COMMERCE_OWNER']
};

const HOST: SubscriptionDashboardUser = { id: 'user-host-1', roles: ['USER', 'HOST'] };

const GASTRONOMY_SUBSCRIPTION = {
    id: 'sub-gastronomy-1',
    planSlug: 'gastronomy-basico',
    planName: 'Gastronomía Básico',
    status: 'active' as const,
    isComplimentary: false,
    currentPeriodStart: '2026-08-23T00:00:00Z',
    currentPeriodEnd: '2026-09-23T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    monthlyPriceArs: 3_000_000,
    paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2027 }
};

const ACCOMMODATION_SUBSCRIPTION = {
    ...GASTRONOMY_SUBSCRIPTION,
    id: 'sub-accommodation-1',
    planSlug: 'owner-pro',
    planName: 'Profesional'
};

/** The gastronomy vertical's real tiers. */
const GASTRONOMY_PLANS = [
    {
        slug: 'gastronomy-basico',
        name: 'Gastronomía Básico',
        monthlyPriceArs: 3_000_000,
        entitlements: [],
        sortOrder: 1
    },
    {
        slug: 'gastronomy-pro',
        name: 'Gastronomía Profesional',
        monthlyPriceArs: 6_500_000,
        entitlements: [],
        sortOrder: 2
    },
    {
        slug: 'gastronomy-premium',
        name: 'Gastronomía Premium',
        monthlyPriceArs: 8_000_000,
        entitlements: [],
        sortOrder: 3
    }
];

/** The tourist plans the broken dashboard used to offer. */
const TOURIST_PLANS = [
    {
        id: 'p1',
        slug: 'tourist-free',
        name: 'Free',
        description: '',
        category: 'tourist' as const,
        monthlyPriceArs: 0,
        annualPriceArs: null,
        monthlyPriceUsdRef: 0,
        hasTrial: false,
        trialDays: 0,
        isDefault: true,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
    },
    {
        id: 'p2',
        slug: 'tourist-vip',
        name: 'VIP',
        description: '',
        category: 'tourist' as const,
        monthlyPriceArs: 1_500_000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 0,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 2,
        isActive: true,
        entitlements: [],
        limits: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
    }
];

function mockSubscription(subscription: unknown) {
    mockGetSubscription.mockResolvedValue({ ok: true, data: { subscription } });
    mockListInvoices.mockResolvedValue({ ok: true, data: { invoices: [] } });
}

async function waitForLoaded() {
    await waitFor(() => {
        expect(screen.queryByTestId('subscription-loading')).not.toBeInTheDocument();
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SubscriptionDashboard — plan change per product domain (HOS-1213)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('a gastronomy subscription', () => {
        it('offers the commerce flow, scoped to its own vertical', async () => {
            mockSubscription(GASTRONOMY_SUBSCRIPTION);

            render(
                <SubscriptionDashboard
                    locale="es"
                    user={COMMERCE_OWNER}
                    plans={[]}
                    commercePlans={GASTRONOMY_PLANS}
                    productDomain="gastronomy"
                />
            );
            await waitForLoaded();

            await waitFor(() => {
                expect(screen.getByTestId('commerce-plan-change')).toBeInTheDocument();
            });
            expect(screen.getByTestId('commerce-vertical')).toHaveTextContent('gastronomy');
            expect(screen.getByTestId('commerce-current-plan')).toHaveTextContent(
                'gastronomy-basico'
            );
        });

        it("offers this vertical's tiers and NO tourist plan", async () => {
            // The reported symptom, inverted: the offer must be the gastronomy
            // catalogue, and `tourist-free` / `tourist-vip` must be nowhere in it.
            mockSubscription(GASTRONOMY_SUBSCRIPTION);

            render(
                <SubscriptionDashboard
                    locale="es"
                    user={COMMERCE_OWNER}
                    plans={[]}
                    commercePlans={GASTRONOMY_PLANS}
                    productDomain="gastronomy"
                />
            );
            await waitForLoaded();

            const offered = await screen.findByTestId('commerce-offered-plans');
            expect(offered).toHaveTextContent('gastronomy-pro');
            expect(offered).toHaveTextContent('gastronomy-premium');
            expect(offered.textContent).not.toContain('tourist-free');
            expect(offered.textContent).not.toContain('tourist-vip');
        });

        it('never renders the accommodation "Cambiar plan" button, even when tourist plans are passed', async () => {
            // The defence that matters: were the page to regress and hand the
            // accommodation catalogue to a commerce dashboard again, the
            // accommodation flow must still not be offered.
            mockSubscription(GASTRONOMY_SUBSCRIPTION);

            render(
                <SubscriptionDashboard
                    locale="es"
                    user={COMMERCE_OWNER}
                    plans={TOURIST_PLANS}
                    commercePlans={GASTRONOMY_PLANS}
                    productDomain="gastronomy"
                />
            );
            await waitForLoaded();

            expect(
                screen.queryByRole('button', { name: /cambiar plan de suscripción/i })
            ).not.toBeInTheDocument();
        });
    });

    describe('an accommodation subscription', () => {
        it('still offers the accommodation flow and not the commerce one', async () => {
            mockSubscription(ACCOMMODATION_SUBSCRIPTION);

            render(
                <SubscriptionDashboard
                    locale="es"
                    user={HOST}
                    plans={TOURIST_PLANS}
                    commercePlans={[]}
                    productDomain="accommodation"
                />
            );
            await waitForLoaded();

            expect(
                screen.getByRole('button', { name: /cambiar plan de suscripción/i })
            ).toBeInTheDocument();
            expect(screen.queryByTestId('commerce-plan-change')).not.toBeInTheDocument();
        });
    });
});
