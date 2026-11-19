import { fireEvent, render, screen } from '@testing-library/react';
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
    freeUnderGrantVerticals: []
};
const sub = (id: string) => ({
    id,
    vertical: 'accommodation',
    status: 'ACTIVE',
    plan: { slug: 'pro', name: 'Plan alojamientos', amount: 1, currency: 'ARS', cycle: 'monthly' }
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

const CASES = [
    {
        code: 'ADDON_PRODUCT_NOT_FOUND',
        reason: 'PRODUCT_NOT_FOUND',
        status: 404,
        text: 'Este complemento ya no está disponible'
    },
    {
        code: 'ADDON_TARGET_NOT_FOUND',
        reason: 'TARGET_NOT_FOUND',
        status: 404,
        text: 'No encontramos la suscripción o la ficha que elegiste'
    },
    {
        code: 'ADDON_NO_VALID_TITLE',
        reason: 'NO_VALID_TITLE',
        status: 409,
        text: 'necesitás un plan activo'
    },
    {
        code: 'ADDON_VERSION_NOT_CURRENT',
        reason: 'ADDON_VERSION_NOT_CURRENT',
        status: 409,
        text: 'cambiaron'
    },
    {
        code: 'ADDON_ORDER_REQUEST_REUSED',
        reason: 'ORDER_REQUEST_REUSED',
        status: 409,
        text: 'Esta compra ya se envió'
    }
] as const;

describe('HOS-2370 purchase rejection codes are translated', () => {
    it.each(CASES)('translates $code instead of showing the raw code', async (c) => {
        listMine.mockResolvedValue({ ok: true, data: { subscriptions: [sub(subA)] } });
        listRecurringAddons.mockResolvedValue({ ok: true, data: { items: [] } });
        purchase.mockResolvedValue({
            ok: false,
            error: { status: c.status, code: c.code, reason: c.reason, message: c.reason }
        });
        mount();
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        await screen.findByTestId('addon-purchase-summary');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).not.toContain(c.reason);
        expect(alert.textContent).not.toContain(c.code);
        expect(alert.textContent).toContain(c.text);
    });
});
