import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, listMine } = vi.hoisted(() => ({ offers: vi.fn(), listMine: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        offers,
        purchase: vi.fn(),
        chooseFree: vi.fn(),
        readPurchase: vi.fn(),
        listRecurringAddons: vi.fn().mockResolvedValue({ ok: true, data: { items: [] } })
    }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: vi.fn() },
    billingSubscriptionApi: { listMine }
}));

const productId = '123e4567-e89b-42d3-a456-426614174001';
const offer = {
    productId,
    addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
    name: 'Photos Pack',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1200,
    currency: 'ARS',
    compatibleVerticals: ['accommodation'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
};

beforeEach(() => {
    vi.clearAllMocks();
    offers.mockResolvedValue({ ok: true, data: { items: [offer] } });
    // A trial is Hospeda's own state: it leaves no ACTIVE principal subscription.
    listMine.mockResolvedValue({
        ok: true,
        data: { subscriptions: [], deferredCourtesies: [], declinedSignups: [] }
    });
});

async function plansHrefFor(compatibleVerticals: readonly string[]) {
    offers.mockResolvedValue({ ok: true, data: { items: [{ ...offer, compatibleVerticals }] } });
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
        />
    );
    fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
    await screen.findByTestId('addon-no-subscriptions');
    return screen.getByTestId('addon-no-subscriptions-plans').getAttribute('href');
}

describe('HOS-2426 plans link follows the addon audience', () => {
    it('links a venue-only addon to the venue pricing page', async () => {
        expect(await plansHrefFor(['venue'])).toBe('/es/planes/comer-y-salir/precios/');
    });
    it('links an accommodation-only addon to the owner pricing page', async () => {
        expect(await plansHrefFor(['accommodation'])).toBe('/es/planes/anfitriones/precios/');
    });
    it('links a multi-vertical addon to the neutral plans index', async () => {
        expect(await plansHrefFor(['accommodation', 'venue'])).toBe('/es/suscriptores/planes/');
    });
});

describe('HOS-2426 addon with no eligible subscription', () => {
    it('explains why and offers the plans page instead of a bare dead end', async () => {
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        const notice = await screen.findByTestId('addon-no-subscriptions');
        expect(notice.textContent).toContain('plan de pago activo');
        const link = screen.getByTestId('addon-no-subscriptions-plans');
        expect(link.getAttribute('href')).toMatch(/^\/es\//);
        expect(link.textContent).toBe('Ver planes');
    });
});
