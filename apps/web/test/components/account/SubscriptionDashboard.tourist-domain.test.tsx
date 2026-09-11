/**
 * @file SubscriptionDashboard.tourist-domain.test.tsx
 * @description HOS-1321: what the fourth dashboard domain may and may not
 * offer.
 *
 * ## The bug these reproduce
 *
 * `canPause` / `canResume` were gated on `commerceVertical === null` (HOS-1278).
 * That is a NEGATION, and `isCommerceVertical('tourist')` is `false`, so the
 * fourth domain walked straight through it: a `tourist-vip` holder was offered
 * "Pausar suscripción" and a confirm modal reading «tus alojamientos se ocultan
 * del sitio y no podrás editarlos» — about accommodation they do not have.
 *
 * The backend is NOT a backstop, and this file previously claimed it was.
 * `POST /billing/subscriptions/pause` has two dimensions and gates one:
 * `billing.subscriptions.pause` (`subscription-pause.ts:258`) pauses the
 * MercadoPago preapproval for EVERY domain, ungated, while only
 * `setOwnerServiceSuspension` sits behind `isAccommodationDomainSubscription`
 * (`:414`) — which is what makes `accommodationsUpdated` come back `0`. A
 * tourist pause really would have stopped their charges; the hidden-accommodation
 * promise was the only impossible half. "Fails closed" on a two-dimension route
 * has to be read one dimension at a time.
 *
 * Owner ruling, 2026-09-10: a traveller should not be pausing, and no new copy
 * is to be written for them — close the gate. So these assert the ABSENCE of
 * the action, never a tourist-specific string.
 *
 * The plan-change flow is the opposite case and is asserted here too: tourist
 * legitimately uses the ACCOMMODATION flow (`plan-domains.config.ts` files both
 * catalogues under the same plan-change route), so the same sweep must not have
 * closed that by accident.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isAccommodationDashboard,
    isAccommodationPlanChangeDashboard,
    SubscriptionDashboard,
    type SubscriptionDashboardUser
} from '../../../src/components/account/SubscriptionDashboard.client';
import { SUBSCRIPTION_DASHBOARD_DOMAINS } from '../../../src/lib/billing/subscription-domain';

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

vi.mock('../../../src/components/commerce/CommercePlanChange.client', () => ({
    CommercePlanChange: (props: { vertical: string }) => (
        <div data-testid="commerce-plan-change">{props.vertical}</div>
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

// Written out inline in both factories: `vi.mock` is hoisted above every
// top-level binding, so a shared helper throws at collection time.
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

/** A traveller. No HOST role — they own no accommodation at all. */
const TOURIST: SubscriptionDashboardUser = { id: 'user-tourist-1', roles: ['USER'] };

const HOST: SubscriptionDashboardUser = { id: 'user-host-1', roles: ['USER', 'HOST'] };

const TOURIST_VIP_SUBSCRIPTION = {
    id: 'sub-tourist-1',
    planSlug: 'tourist-vip',
    planName: 'VIP',
    status: 'active' as const,
    isComplimentary: false,
    currentPeriodStart: '2026-08-23T00:00:00Z',
    currentPeriodEnd: '2026-09-23T00:00:00Z',
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    monthlyPriceArs: 1_500_000,
    paymentMethod: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2027 }
};

const OWNER_SUBSCRIPTION = {
    ...TOURIST_VIP_SUBSCRIPTION,
    id: 'sub-accommodation-1',
    planSlug: 'owner-pro',
    planName: 'Profesional'
};

const PAUSED_TOURIST_SUBSCRIPTION = {
    ...TOURIST_VIP_SUBSCRIPTION,
    status: 'paused' as const
};

/** The tourist tiers, as `?domain=tourist` now serves them. */
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

const PAUSE_LABEL = /Pausar suscripci[oó]n/i;
const RESUME_LABEL = /Reanudar/i;
const CHANGE_PLAN_LABEL = /Cambiar plan/i;

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

describe('SubscriptionDashboard — the tourist domain (HOS-1321)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('offers NO pause on an active tourist subscription', async () => {
        // Arrange
        mockSubscription(TOURIST_VIP_SUBSCRIPTION);

        // Act
        render(
            <SubscriptionDashboard
                locale="es"
                user={TOURIST}
                plans={TOURIST_PLANS}
                commercePlans={[]}
                productDomain="tourist"
            />
        );
        await waitForLoaded();

        // Assert
        expect(screen.queryByRole('button', { name: PAUSE_LABEL })).not.toBeInTheDocument();
    });

    it('offers NO resume on a paused tourist subscription', async () => {
        // Arrange — the other half of the same gate. Without it a traveller
        // could reactivate a preapproval through a flow written for hosts.
        mockSubscription(PAUSED_TOURIST_SUBSCRIPTION);

        // Act
        render(
            <SubscriptionDashboard
                locale="es"
                user={TOURIST}
                plans={TOURIST_PLANS}
                commercePlans={[]}
                productDomain="tourist"
            />
        );
        await waitForLoaded();

        // Assert
        expect(screen.queryByRole('button', { name: RESUME_LABEL })).not.toBeInTheDocument();
    });

    it('STILL offers pause on the accommodation dashboard', async () => {
        // Arrange — the control. Without it the two assertions above pass on a
        // dashboard that renders no buttons at all, and the gate could be
        // closed for everybody without anything going red.
        mockSubscription(OWNER_SUBSCRIPTION);

        // Act
        render(
            <SubscriptionDashboard
                locale="es"
                user={HOST}
                plans={[]}
                commercePlans={[]}
                productDomain="accommodation"
            />
        );
        await waitForLoaded();

        // Assert
        expect(screen.getByRole('button', { name: PAUSE_LABEL })).toBeInTheDocument();
    });

    it('offers the ACCOMMODATION plan-change flow, never the commerce one', async () => {
        // Arrange — the sweep that closed pause must not have closed this:
        // `plan-domains.config.ts` files the tourist tiers under the
        // accommodation plan-change route, and there is no per-vertical route
        // for travellers the way commerce has one.
        mockSubscription(TOURIST_VIP_SUBSCRIPTION);

        // Act
        render(
            <SubscriptionDashboard
                locale="es"
                user={TOURIST}
                plans={TOURIST_PLANS}
                commercePlans={[]}
                productDomain="tourist"
            />
        );
        await waitForLoaded();

        // Assert
        expect(screen.getByRole('button', { name: CHANGE_PLAN_LABEL })).toBeInTheDocument();
        expect(screen.queryByTestId('commerce-plan-change')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// The classification tripwire
// ---------------------------------------------------------------------------

describe('dashboard domain classification is by INCLUSION (HOS-1321)', () => {
    /**
     * What each domain is allowed to do, restated by hand.
     *
     * The point of writing it out is that a FIFTH dashboard domain has no entry
     * here and fails the sweep below — which is the whole ask: a gate written as
     * "not commerce" widens itself silently with every new value, and that is
     * exactly how `tourist` acquired a pause button nobody chose to give it.
     */
    const EXPECTED: Readonly<
        Record<
            string,
            { readonly canPause: boolean; readonly usesAccommodationPlanChange: boolean }
        >
    > = {
        accommodation: { canPause: true, usesAccommodationPlanChange: true },
        tourist: { canPause: false, usesAccommodationPlanChange: true },
        gastronomy: { canPause: false, usesAccommodationPlanChange: false },
        experience: { canPause: false, usesAccommodationPlanChange: false }
    };

    it('classifies every dashboard domain deliberately', () => {
        // Arrange & Act & Assert
        for (const domain of SUBSCRIPTION_DASHBOARD_DOMAINS) {
            const expected = EXPECTED[domain];
            expect(
                expected,
                `No classification for dashboard domain '${domain}'. A new domain must be ` +
                    'classified here AND in the predicates it reaches — it does not inherit ' +
                    "another domain's actions by not being commerce."
            ).toBeDefined();
            expect(isAccommodationDashboard(domain)).toBe(expected?.canPause);
            expect(isAccommodationPlanChangeDashboard(domain)).toBe(
                expected?.usesAccommodationPlanChange
            );
        }
    });

    it('excludes an unknown domain from both, rather than defaulting it in', () => {
        // Arrange & Act & Assert — the direction that matters. An inclusion list
        // answers `false` for a value nobody classified; the negation it
        // replaced answered `true`.
        const unknown = 'a-domain-nobody-classified' as never;
        expect(isAccommodationDashboard(unknown)).toBe(false);
        expect(isAccommodationPlanChangeDashboard(unknown)).toBe(false);
    });

    it('treats an omitted domain as accommodation', () => {
        // Arrange & Act & Assert — the prop is optional and every caller that
        // omits it is the accommodation dashboard, whose server-side default is
        // that same domain. Changing this silently removes pause from the
        // dashboard's original caller.
        expect(isAccommodationDashboard(undefined)).toBe(true);
        expect(isAccommodationPlanChangeDashboard(undefined)).toBe(true);
    });
});
