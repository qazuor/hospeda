import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const ONE_TIME = {
    ...baseOffer,
    chargeKind: 'UNA_VEZ',
    cycle: null,
    validity: 'FIXED_DAYS',
    validityDays: 7
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
                {
                    listingId,
                    name: 'Cabaña del Río',
                    publicationStatus: status,
                    recurringListingAddons: 0,
                    recurringListingAddonItems: [],
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
        />
    );
    fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
    const item = await screen.findByTestId(`addon-target-${listingId}`);
    expect(item.getAttribute('data-publication-status')).toBe(status);
    fireEvent.click(item);
    return screen.findByTestId('addon-purchase-summary');
}

describe('AC:B10:11 / TEST:B10:13 purchase screen', () => {
    it('shows the listing name instead of its UUID in the target card', async () => {
        listingNotices.mockResolvedValue({
            ok: true,
            data: {
                trialRunning: false,
                items: [
                    {
                        listingId,
                        name: 'Cabaña del Río',
                        publicationStatus: 'PUBLISHED',
                        recurringListingAddons: 0,
                        recurringListingAddonItems: [],
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
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));

        const card = await screen.findByTestId(`addon-target-${listingId}`);
        expect(within(card).getByText('Cabaña del Río')).toBeInTheDocument();
        expect(within(card).queryByText(listingId)).not.toBeInTheDocument();
    });

    it('shows the paused notice when A1 returns ADDON_PURCHASES_FROZEN', async () => {
        await selectListing('PUBLISHED');
        purchase.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'ADDON_PURCHASES_FROZEN', message: 'paused' }
        });
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        expect(await screen.findByTestId('addon-purchases-paused-notice')).toBeInTheDocument();
    });
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
    it('lists one-time offers next to recurring ones (HOS-2179 D-4)', async () => {
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
        expect(screen.getByTestId('addon-offer-one-time')).toBeTruthy();
    });
    it('sells a one-time addon on Mercado Pago without asking for card data or the payer email', async () => {
        offers.mockResolvedValue({
            ok: true,
            data: { items: [{ ...ONE_TIME, scopeType: 'USER' }] }
        });
        purchase.mockResolvedValue({
            ok: true,
            data: {
                outcome: 'CREATED',
                instanceId: listingId,
                chargeKind: 'UNA_VEZ',
                processing: false,
                checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1'
            }
        });
        const navigateToCheckout = vi.fn();
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
                navigateToCheckout={navigateToCheckout}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        const summary = await screen.findByTestId('addon-purchase-summary');
        expect(summary.textContent).toContain('7 días');
        expect(summary.textContent).toContain('se cobra una sola vez');
        expect(screen.getByTestId('addon-instant-methods').textContent).toContain(
            'No se aceptan pagos en efectivo'
        );
        expect(within(summary).queryByRole('textbox')).toBeNull();
        expect(summary.querySelector('input')).toBeNull();
        const confirm = screen.getByTestId('addon-purchase-confirm');
        expect(confirm.textContent).toBe('Pagar con Mercado Pago');
        fireEvent.click(confirm);
        await waitFor(() =>
            expect(navigateToCheckout).toHaveBeenCalledWith(
                'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1'
            )
        );
        expect(purchase).toHaveBeenCalledWith({
            body: { productId, addonVersionId: versionId, targetId: null, orderRequestId: orderId }
        });
    });
    it('warns that a one-time boost runs even on a hidden listing', async () => {
        offers.mockResolvedValue({ ok: true, data: { items: [ONE_TIME] } });
        await selectListing('DRAFT');
        const notice = screen.getByTestId('addon-hidden-listing-notice');
        expect(notice.getAttribute('data-notice-kind')).toBe('ONE_TIME');
        expect(notice.textContent).toContain('corre igual aunque la ficha no se vea');
    });
    it('reads a replayed purchase that is no longer waiting instead of paying again', async () => {
        offers.mockResolvedValue({
            ok: true,
            data: { items: [{ ...ONE_TIME, scopeType: 'USER' }] }
        });
        purchase.mockResolvedValue({
            ok: true,
            data: {
                outcome: 'EXISTING',
                instanceId: listingId,
                chargeKind: 'UNA_VEZ',
                processing: false
            }
        });
        readPurchase.mockResolvedValue({
            ok: true,
            data: {
                instanceId: listingId,
                status: 'ACTIVE',
                chargeKind: 'UNA_VEZ',
                processing: false
            }
        });
        const navigateToCheckout = vi.fn();
        render(
            <AddonPurchase
                locale="es"
                returnOrderRequestId={null}
                accountEmail="payer@example.test"
                navigateToCheckout={navigateToCheckout}
            />
        );
        fireEvent.click(await screen.findByTestId(`addon-offer-${productId}`));
        fireEvent.click(await screen.findByTestId('addon-purchase-confirm'));
        expect(await screen.findByTestId('addon-purchase-active')).toBeTruthy();
        expect(readPurchase).toHaveBeenCalledWith({ orderRequestId: orderId });
        expect(navigateToCheckout).not.toHaveBeenCalled();
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
    it.each([
        ['PROVIDER_REJECTED', 'VALIDATION_ERROR', 422],
        ['PROVIDER_BUSY', 'PROVIDER_RATE_LIMITED', 503],
        ['ORDER_REQUEST_ABANDONED', 'ADDON_ORDER_REQUEST_ABANDONED', 409]
    ])('mints a new order id after a %s answer so the retry is a new order', async (reason, code, status) => {
        const ids = [orderId, '123e4567-e89b-42d3-a456-426614174099'];
        vi.stubGlobal('crypto', { randomUUID: vi.fn(() => ids.shift() ?? orderId) });
        await selectListing('PUBLISHED');
        purchase.mockResolvedValueOnce({
            ok: false,
            error: { status, code, reason, message: 'refused' }
        });
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await screen.findByRole('alert');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(purchase).toHaveBeenCalledTimes(2));
        const sent = purchase.mock.calls.map(([call]) => call.body.orderRequestId);
        expect(sent).toEqual([orderId, '123e4567-e89b-42d3-a456-426614174099']);
    });
    it('shows the dedicated expired-attempt copy for an abandoned order', async () => {
        await selectListing('PUBLISHED');
        purchase.mockResolvedValueOnce({
            ok: false,
            error: {
                status: 409,
                code: 'ADDON_ORDER_REQUEST_ABANDONED',
                reason: 'ORDER_REQUEST_ABANDONED',
                message: 'ORDER_REQUEST_ABANDONED'
            }
        });
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).not.toContain('ORDER_REQUEST_ABANDONED');
        expect(alert.textContent).not.toBe('billing.addonPurchase.loadError');
        expect(alert.textContent).toMatch(/intento|attempt|tentativa/i);
    });
    it('keeps the same order id after a failure that does not release it', async () => {
        await selectListing('PUBLISHED');
        purchase.mockResolvedValueOnce({
            ok: false,
            error: {
                status: 503,
                code: 'SERVICE_UNAVAILABLE',
                reason: 'PROVIDER_UNAVAILABLE',
                message: 'down'
            }
        });
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await screen.findByRole('alert');
        fireEvent.click(screen.getByTestId('addon-purchase-confirm'));
        await waitFor(() => expect(purchase).toHaveBeenCalledTimes(2));
        expect(purchase.mock.calls.map(([call]) => call.body.orderRequestId)).toEqual([
            orderId,
            orderId
        ]);
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
                        name: 'Cabaña del Río',
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
                    name: 'Cabaña del Río',
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

    describe('HOS-2179 P-1 return from a one-time payment page', () => {
        const pending = {
            instanceId: listingId,
            status: 'PENDING_AUTHORIZATION',
            chargeKind: 'UNA_VEZ',
            processing: true
        };
        const back = () =>
            render(
                <AddonPurchase
                    locale="es"
                    returnOrderRequestId={orderId}
                    accountEmail="payer@example.test"
                />
            );

        it('says the payment is being confirmed, then shows it active', async () => {
            readPurchase.mockResolvedValueOnce({ ok: true, data: pending }).mockResolvedValue({
                ok: true,
                data: { ...pending, status: 'ACTIVE', processing: false }
            });
            back();
            expect(await screen.findByText('Estamos confirmando tu pago.')).toBeTruthy();
            expect(readPurchase).toHaveBeenCalledWith({ orderRequestId: orderId });
            expect(
                await screen.findByTestId('addon-purchase-active', {}, { timeout: 5000 })
            ).toBeTruthy();
            expect(readPurchase).toHaveBeenCalledTimes(2);
        }, 8000);

        it('says the result comes by mail once the screen stops asking', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            readPurchase.mockResolvedValue({ ok: true, data: pending });
            back();
            for (let tick = 0; tick < 12; tick++)
                await act(async () => {
                    await vi.advanceTimersByTimeAsync(3000);
                });
            const status = screen.getByTestId('addon-purchase-processing');
            expect(status.getAttribute('data-exhausted')).toBe('true');
            expect(status.textContent).toContain('Te avisamos por correo cuando se acredite');
            expect(readPurchase).toHaveBeenCalledTimes(10);
        });

        it('says the page expired when the purchase was abandoned', async () => {
            readPurchase.mockResolvedValue({
                ok: true,
                data: { ...pending, status: 'ABANDONED', processing: false }
            });
            back();
            expect((await screen.findByTestId('addon-purchase-closed')).textContent).toBe(
                'La página de pago venció sin un pago aprobado. Podés volver a comprarlo.'
            );
        });

        it('keeps the generic copy for a recurring checkout that closed', async () => {
            readPurchase.mockResolvedValue({
                ok: true,
                data: {
                    ...pending,
                    chargeKind: 'PERIODICO',
                    status: 'ABANDONED',
                    processing: false
                }
            });
            back();
            expect((await screen.findByTestId('addon-purchase-closed')).textContent).toBe(
                'La compra terminó sin activarse.'
            );
        });
    });
});
