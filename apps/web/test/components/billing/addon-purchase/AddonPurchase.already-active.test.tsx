import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, purchase, listMine, listRecurringAddons } = vi.hoisted(() => ({
    offers: vi.fn(),
    purchase: vi.fn(),
    listMine: vi.fn(),
    listRecurringAddons: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        offers,
        purchase,
        chooseFree: vi.fn(),
        readPurchase: vi.fn(),
        listRecurringAddons
    }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: vi.fn() },
    billingSubscriptionApi: { listMine }
}));

const productId = '123e4567-e89b-42d3-a456-426614174001';
const subA = '123e4567-e89b-42d3-a456-426614174010';
const subB = '123e4567-e89b-42d3-a456-426614174011';
const orderId = '123e4567-e89b-42d3-a456-426614174004';
const offer = {
    productId,
    addonVersionId: '123e4567-e89b-42d3-a456-426614174002',
    slug: 'extra-accommodations-5',
    name: 'Extra accommodations pack (+5)',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1200,
    currency: 'ARS',
    compatibleVerticals: ['accommodation'],
    scopeType: 'VERTICAL_SUBSCRIPTION',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: [],
    grantedKeys: ['max_accommodations']
};
const sub = (id: string) => ({
    id,
    vertical: 'accommodation',
    status: 'ACTIVE',
    plan: { slug: 'pro', name: 'Plan alojamientos', amount: 1, currency: 'ARS', cycle: 'monthly' }
});
const activeOn = (targetId: string) => ({
    addonInstanceId: '123e4567-e89b-42d3-a456-426614174099',
    slug: offer.slug,
    name: offer.name,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1200,
    currency: 'ARS',
    status: 'ACTIVE',
    targetId,
    targetName: null
});
const mount = () =>
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
        />
    );

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => orderId) });
    offers.mockResolvedValue({ ok: true, data: { items: [offer] } });
});
afterEach(() => vi.unstubAllGlobals());

describe('HOS-2362 already-active addons', () => {
    it('shows an addon the account already has as Activo, with no way to buy it', async () => {
        listMine.mockResolvedValue({ ok: true, data: { subscriptions: [sub(subA)] } });
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [activeOn(subA)] } });
        mount();
        const card = await screen.findByTestId(`addon-offer-${productId}`);
        await waitFor(() => expect(card).toHaveAttribute('aria-disabled', 'true'));
        expect(card).not.toBeDisabled();
        expect(card.textContent).toContain('Activo');
        fireEvent.click(card);
        expect(screen.queryByTestId('addon-purchase-summary')).toBeNull();
        expect(purchase).not.toHaveBeenCalled();
    });

    it('keeps the offer buyable while another subscription still lacks it, and marks the covered one', async () => {
        listMine.mockResolvedValue({ ok: true, data: { subscriptions: [sub(subA), sub(subB)] } });
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [activeOn(subA)] } });
        mount();
        const card = await screen.findByTestId(`addon-offer-${productId}`);
        await waitFor(() => expect(listRecurringAddons).toHaveBeenCalled());
        expect((card as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(card);
        const covered = await screen.findByTestId(`addon-subscription-${subA}`);
        expect((covered as HTMLButtonElement).disabled).toBe(true);
        expect(covered.textContent).toContain('Activo');
        expect(
            (screen.getByTestId(`addon-subscription-${subB}`) as HTMLButtonElement).disabled
        ).toBe(false);
    });

    it('translates a 409 ALREADY_ACTIVE race instead of showing the raw code', async () => {
        listMine.mockResolvedValue({ ok: true, data: { subscriptions: [sub(subA)] } });
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
        purchase.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'ADDON_ALREADY_ACTIVE',
                reason: 'ALREADY_ACTIVE',
                message: 'ALREADY_ACTIVE'
            }
        });
        mount();
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        await screen.findByTestId('addon-purchase-summary');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).not.toContain('ALREADY_ACTIVE');
        expect(alert.textContent).toContain('Ya tenés este complemento activo');
    });
});
