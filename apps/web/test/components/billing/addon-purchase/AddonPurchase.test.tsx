import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, purchase, chooseFree, readPurchase, listingNotices } = vi.hoisted(() => ({
    offers: vi.fn(),
    purchase: vi.fn(),
    chooseFree: vi.fn(),
    readPurchase: vi.fn(),
    listingNotices: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { offers, purchase, chooseFree, readPurchase }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({ publishApi: { listingNotices } }));

const productId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const listingId = '123e4567-e89b-42d3-a456-426614174003';
const orderId = '123e4567-e89b-42d3-a456-426614174004';
const baseOffer = {
    productId,
    addonVersionId: versionId,
    name: 'Destaque',
    description: null,
    chargeKind: 'PERIODICO',
    cycle: 'monthly',
    price: 1200,
    currency: 'ARS',
    compatibleVerticals: ['accommodation'],
    scopeType: 'LISTING',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    freeUnderGrantVerticals: []
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => orderId) });
    offers.mockResolvedValue({ ok: true, data: { items: [baseOffer] } });
    listingNotices.mockResolvedValue({ ok: true, data: { trialRunning: false, items: [] } });
    purchase.mockResolvedValue({
        ok: true,
        data: {
            outcome: 'CREATED',
            instanceId: listingId,
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl: 'https://checkout.example.test/'
        }
    });
    chooseFree.mockResolvedValue({
        ok: true,
        data: { outcome: 'CREATED', instanceId: listingId, status: 'ACTIVE' }
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function selectListing(status: string) {
    listingNotices.mockResolvedValue({
        ok: true,
        data: {
            trialRunning: false,
            items: [
                { listingId, publicationStatus: status, recurringListingAddons: 0, notices: [] }
            ]
        }
    });
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={null}
            accountEmail="payer@example.test"
        />
    );
    fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
    const item = await screen.findByTestId(`addon-target-${listingId}`);
    expect(item.getAttribute('data-publication-status')).toBe(status);
    fireEvent.click(item);
    return screen.findByTestId('addon-purchase-summary');
}

describe('AC:B10:11 / TEST:B10:13 purchase screen', () => {
    it.each([
        'DRAFT',
        'ARCHIVED',
        'UNPUBLISHED_BY_BILLING'
    ])('shows the recurring notice for %s', async (status) => {
        await selectListing(status);
        expect(
            screen.getByTestId('addon-hidden-listing-notice').getAttribute('data-notice-kind')
        ).toBe('RECURRING');
        expect(screen.getByTestId('addon-hidden-listing-notice').textContent).toContain(
            'se cobra igual'
        );
    });
    it('hides one-time offers and shows the existing empty state', async () => {
        offers.mockResolvedValue({
            ok: true,
            data: {
                items: [
                    {
                        ...baseOffer,
                        chargeKind: 'UNA_VEZ',
                        cycle: null,
                        validity: 'FIXED_DAYS',
                        validityDays: 30
                    }
                ]
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        expect(await screen.findByText('No hay complementos disponibles.')).toBeTruthy();
        expect(screen.queryByTestId(`addon-offer-${productId}`)).toBeNull();
        expect(listingNotices).not.toHaveBeenCalled();
    });
    it('shows recurring offers when the API also returns one-time offers', async () => {
        offers.mockResolvedValue({
            ok: true,
            data: {
                items: [{ ...baseOffer, productId: 'one-time', chargeKind: 'UNA_VEZ' }, baseOffer]
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        expect(await screen.findByTestId(`addon-offer-${productId}`)).toBeTruthy();
        expect(screen.queryByTestId('addon-offer-one-time')).toBeNull();
    });
    it('shows no paid notice for a published listing or free choice', async () => {
        await selectListing('PUBLISHED');
        expect(screen.queryAllByTestId('addon-hidden-listing-notice')).toHaveLength(0);
    });
    it('shows free benefit, calls chooseFree and becomes active', async () => {
        offers.mockResolvedValue({
            ok: true,
            data: { items: [{ ...baseOffer, freeUnderGrantVerticals: ['accommodation'] }] }
        });
        await selectListing('DRAFT');
        expect(screen.queryAllByTestId('addon-hidden-listing-notice')).toHaveLength(0);
        expect(screen.getByText('Gratis por tu beneficio')).toBeTruthy();
        fireEvent.click(screen.getByTestId('addon-free-choice-confirm'));
        await waitFor(() =>
            expect(chooseFree).toHaveBeenCalledWith({
                body: {
                    productId,
                    addonVersionId: versionId,
                    targetId: listingId,
                    orderRequestId: orderId
                }
            })
        );
        expect(await screen.findByText('Activo')).toBeTruthy();
    });
    it('mints the order once when the summary opens', async () => {
        purchase.mockResolvedValue({
            ok: true,
            data: {
                outcome: 'PENDING_ELSEWHERE',
                instanceId: listingId,
                chargeKind: 'PERIODICO',
                processing: true
            }
        });
        await selectListing('DRAFT');
        expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(purchase).toHaveBeenCalled());
        expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    });
    it('redirects a recurring purchase to checkout', async () => {
        const assign = vi.fn();
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: [
                    {
                        listingId,
                        publicationStatus: 'DRAFT',
                        recurringListingAddons: 0,
                        notices: []
                    }
                ]
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
                navigateToCheckout={assign}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        fireEvent.click(await screen.findByTestId(`addon-target-${listingId}`));
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.example.test/'));
        expect(purchase).toHaveBeenCalledWith({
            body: {
                productId,
                addonVersionId: versionId,
                targetId: listingId,
                orderRequestId: orderId,
                payerEmail: 'payer@example.test'
            }
        });
    });
    it('shows processing for PENDING_ELSEWHERE', async () => {
        purchase.mockResolvedValue({
            ok: true,
            data: {
                outcome: 'PENDING_ELSEWHERE',
                instanceId: listingId,
                chargeKind: 'PERIODICO',
                processing: true
            }
        });
        await selectListing('DRAFT');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        expect(await screen.findByTestId('addon-purchase-processing')).toBeTruthy();
    });
    it('filters PURGED and MODERATED targets', async () => {
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: ['PURGED', 'MODERATED'].map((publicationStatus, index) => ({
                    listingId: index ? '123e4567-e89b-42d3-a456-426614174005' : listingId,
                    publicationStatus,
                    recurringListingAddons: 0,
                    notices: []
                }))
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        expect(
            await screen.findByText('No hay fichas disponibles para este complemento.')
        ).toBeTruthy();
        expect(screen.queryAllByTestId(`addon-target-${listingId}`)).toHaveLength(0);
    });
    it('stops polling after ACTIVE', async () => {
        readPurchase.mockResolvedValue({
            ok: true,
            data: {
                instanceId: listingId,
                status: 'ACTIVE',
                chargeKind: 'PERIODICO',
                processing: false
            }
        });
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={orderId}
                accountEmail="payer@example.test"
            />
        );
        await waitFor(() => expect(offers).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 6400));
        expect(await screen.findByText('Activo')).toBeTruthy();
        expect(readPurchase).toHaveBeenCalledTimes(1);
    }, 8000);
});
