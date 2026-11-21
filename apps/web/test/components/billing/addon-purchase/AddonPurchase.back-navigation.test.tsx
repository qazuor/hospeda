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
const subA = '123e4567-e89b-42d3-a456-426614174010';
const subB = '123e4567-e89b-42d3-a456-426614174011';
const offer = {
    productId,
    addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
    name: 'Photos Pack',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1200,
    currency: 'ARS',
    compatibleVerticals: ['accommodation', 'venue'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
};
const sub = (id: string, vertical: string) => ({
    id,
    vertical,
    status: 'ACTIVE',
    plan: { slug: 'pro', name: `Plan ${vertical}`, amount: 1, currency: 'ARS', cycle: 'monthly' }
});

function mockSubs(subscriptions: readonly unknown[]) {
    listMine.mockResolvedValue({
        ok: true,
        data: { subscriptions, deferredCourtesies: [], declinedSignups: [] }
    });
}
async function pickOffer() {
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
        />
    );
    fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
}

beforeEach(() => {
    vi.clearAllMocks();
    offers.mockResolvedValue({ ok: true, data: { items: [offer] } });
});

describe('HOS-2441 addon purchase has a way back at every step', () => {
    it('offers no Back on the first step', async () => {
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        await screen.findByTestId(`addon-offer-${productId}`);
        expect(screen.queryByTestId('addon-purchase-back')).toBeNull();
    });

    it('goes summary -> subscription picker -> offers', async () => {
        mockSubs([sub(subA, 'accommodation'), sub(subB, 'venue')]);
        await pickOffer();
        fireEvent.click(await screen.findByTestId(`addon-subscription-${subA}`));
        await screen.findByTestId('addon-purchase-summary');

        fireEvent.click(screen.getByTestId('addon-purchase-back'));
        await screen.findByTestId(`addon-subscription-${subB}`);

        fireEvent.click(screen.getByTestId('addon-purchase-back'));
        await screen.findByTestId(`addon-offer-${productId}`);
        expect(screen.queryByTestId('addon-purchase-back')).toBeNull();
    });

    it('skips the picker that was auto-selected: summary goes straight to offers', async () => {
        mockSubs([sub(subA, 'accommodation')]);
        await pickOffer();
        await screen.findByTestId('addon-purchase-summary');
        fireEvent.click(screen.getByTestId('addon-purchase-back'));
        await screen.findByTestId(`addon-offer-${productId}`);
    });

    it('lets the owner leave the empty-subscriptions dead end', async () => {
        mockSubs([]);
        await pickOffer();
        await screen.findByTestId('addon-no-subscriptions');
        fireEvent.click(screen.getByTestId('addon-purchase-back'));
        await screen.findByTestId(`addon-offer-${productId}`);
    });
});
