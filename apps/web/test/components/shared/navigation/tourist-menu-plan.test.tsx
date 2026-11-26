// @vitest-environment jsdom
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UserMenuQuickLinks } from '@/components/shared/navigation/UserMenuQuickLinks';
import { useTouristMenuPlan } from '@/components/shared/navigation/use-tourist-menu-plan';
import { createT } from '@/lib/i18n';
import { getCuratedAccountNav } from '@/lib/nav-avatar';

const { catalog, pricingSituation, listMine } = vi.hoisted(() => ({
    catalog: vi.fn(),
    pricingSituation: vi.fn(),
    listMine: vi.fn()
}));
vi.mock('@/lib/billing/gate-plan-names', () => ({ readTouristCatalog: catalog }));
vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { pricingSituation, listMine }
}));

const floor = { name: 'Free floor', vertical: 'tourist', entitlements: [], limits: {} };
const paid = {
    name: 'Renamed traveler tier',
    slug: 'traveler-paid',
    vertical: 'tourist',
    isActive: true,
    entitlements: ['price_alerts'],
    limits: {},
    billingOptions: {},
    sortOrder: 1
};

it.each([
    ['es', 'hasta 15/12'],
    ['en', 'until 12/15'],
    ['pt', 'até 15/12']
] as const)('uses the %s locale and the Argentina calendar day for renewal', (locale, renewal) => {
    const { quickItems } = getCuratedAccountNav({ permissions: [] });

    render(
        <UserMenuQuickLinks
            items={quickItems}
            locale={locale}
            plan={{ name: paid.name, paid: true, until: '2026-12-16T01:30:00Z', upgrade: null }}
            t={createT(locale)}
            onNavigate={vi.fn()}
        />
    );

    expect(screen.getByText(`${paid.name} ${renewal}`)).toBeVisible();
});

it.each([
    [
        'free',
        { situation: 'CHECKOUT' },
        true,
        { name: floor.name, paid: false, upgrade: paid.name }
    ],
    [
        'direct',
        { situation: 'SUBSCRIBED', status: 'ACTIVE', currentPlanSlug: paid.slug },
        true,
        { name: paid.name, paid: true, until: '2026-12-05T12:00:00Z', upgrade: null }
    ],
    [
        'inherited',
        { situation: 'TOURIST_VIP_INHERITED' },
        true,
        { name: paid.name, paid: true, until: null, upgrade: null }
    ],
    ['missing catalog', { situation: 'CHECKOUT' }, false, null],
    ['failed situation read', null, true, null]
])('resolves the %s menu state', async (_label, situation, catalogOk, expected) => {
    vi.clearAllMocks();
    catalog.mockResolvedValue(catalogOk ? { ok: true, plans: [floor, paid] } : { ok: false });
    pricingSituation.mockResolvedValue(situation ? { ok: true, data: situation } : { ok: false });
    listMine.mockResolvedValue({
        ok: true,
        data: {
            subscriptions: [
                {
                    vertical: 'tourist',
                    status: 'ACTIVE',
                    plan: { slug: paid.slug },
                    nextCharge: { at: '2026-12-05T12:00:00Z' }
                }
            ]
        }
    });

    const { result } = renderHook(() => useTouristMenuPlan({ account: 'account', open: true }));

    await waitFor(() => {
        expect(pricingSituation).toHaveBeenCalledWith({
            vertical: 'tourist',
            cookieHeader: undefined
        });
        if (expected) expect(result.current).toMatchObject(expected);
        else expect(result.current).toBeNull();
    });
});
