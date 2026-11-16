import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, purchase, listMine } = vi.hoisted(() => ({
    offers: vi.fn(),
    purchase: vi.fn(),
    listMine: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { offers, purchase, chooseFree: vi.fn(), readPurchase: vi.fn() }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: vi.fn() },
    billingSubscriptionApi: { listMine }
}));

const productId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const subA = '123e4567-e89b-42d3-a456-426614174010';
const subB = '123e4567-e89b-42d3-a456-426614174011';
const orderId = '123e4567-e89b-42d3-a456-426614174004';
const offer = {
    productId,
    addonVersionId: versionId,
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
const sub = (id: string, vertical: string, status = 'ACTIVE') => ({
    id,
    vertical,
    status,
    plan: { slug: 'pro', name: `Plan ${vertical}`, amount: 1, currency: 'ARS', cycle: 'monthly' }
});

function mockSubs(subscriptions: readonly unknown[]) {
    listMine.mockResolvedValue({
        ok: true,
        data: { subscriptions, deferredCourtesies: [], declinedSignups: [] }
    });
}
function mountAndPick() {
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
            navigateToCheckout={vi.fn()}
        />
    );
    return screen.findByTestId(`addon-offer-${productId}`).then((el) => fireEvent.click(el));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => orderId) });
    offers.mockResolvedValue({ ok: true, data: { items: [offer] } });
    purchase.mockResolvedValue({
        ok: true,
        data: {
            outcome: 'CREATED',
            instanceId: subA,
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl: 'https://checkout.example.test/'
        }
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('HOS-2221 VERTICAL_SUBSCRIPTION addon purchase', () => {
    it('sends the only compatible live principal subscription as targetId', async () => {
        mockSubs([sub(subA, 'accommodation'), sub(subB, 'tourist'), sub('x', 'venue', 'PAUSED')]);
        await mountAndPick();
        await screen.findByTestId('addon-purchase-summary');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(purchase).toHaveBeenCalled());
        expect(purchase.mock.calls[0]?.[0].body.targetId).toBe(subA);
    });

    it('lets the owner choose when several subscriptions are compatible', async () => {
        mockSubs([sub(subA, 'accommodation'), sub(subB, 'venue')]);
        await mountAndPick();
        fireEvent.click(await screen.findByTestId(`addon-subscription-${subB}`));
        await screen.findByTestId('addon-purchase-summary');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(purchase).toHaveBeenCalled());
        expect(purchase.mock.calls[0]?.[0].body.targetId).toBe(subB);
    });

    it('shows the empty state and never calls purchase without a subscription', async () => {
        mockSubs([sub(subA, 'tourist')]);
        await mountAndPick();
        expect(
            await screen.findByText('No hay suscripciones disponibles para este complemento.')
        ).toBeTruthy();
        expect(purchase).not.toHaveBeenCalled();
    });
});
