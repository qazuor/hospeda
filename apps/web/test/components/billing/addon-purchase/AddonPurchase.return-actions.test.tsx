/**
 * HOS-2680: the actions of a recurring add-on purchase the owner came back to from Mercado Pago.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddonPurchase } from '@/components/billing/addon-purchase/AddonPurchase.client';

const { offers, purchase, readPurchase, readRememberedPayerEmail } = vi.hoisted(() => ({
    offers: vi.fn(),
    purchase: vi.fn(),
    readPurchase: vi.fn(),
    readRememberedPayerEmail: vi.fn()
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        offers,
        purchase,
        chooseFree: vi.fn(),
        readPurchase,
        listRecurringAddons: vi.fn(async () => ({ ok: true, data: { items: [] } }))
    }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { listingNotices: vi.fn() },
    billingSubscriptionApi: { listMine: vi.fn(), readRememberedPayerEmail }
}));

const productId = '123e4567-e89b-42d3-a456-426614174001';
const versionId = '123e4567-e89b-42d3-a456-426614174002';
const targetId = '123e4567-e89b-42d3-a456-426614174003';
const returnId = '123e4567-e89b-42d3-a456-426614174004';
const freshId = '123e4567-e89b-42d3-a456-426614174005';
const instanceId = '123e4567-e89b-42d3-a456-426614174006';
const checkoutUrl = 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=1';

const pending = {
    instanceId,
    status: 'PENDING_AUTHORIZATION',
    chargeKind: 'PERIODICO',
    processing: true,
    productId,
    targetId,
    addonVersionId: versionId
};
const closed = { ...pending, status: 'EXPIRED', processing: false };

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => freshId) });
    offers.mockResolvedValue({ ok: true, data: { items: [] } });
    readRememberedPayerEmail.mockResolvedValue({ ok: true, data: { rememberedPayerEmail: null } });
    purchase.mockResolvedValue({
        ok: true,
        data: {
            outcome: 'EXISTING',
            instanceId,
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl
        }
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

function back(read: object) {
    readPurchase.mockResolvedValue({ ok: true, data: read });
    const navigate = vi.fn();
    render(
        <AddonPurchase
            locale="es"
            returnOrderRequestId={returnId}
            accountEmail="owner@example.test"
            navigateToCheckout={navigate}
        />
    );
    return { navigate };
}

describe('HOS-2680 return actions: pending recurring purchase', () => {
    it('shows «Reintentar el pago» and «Usar otro mail»', async () => {
        back(pending);
        expect((await screen.findByTestId('addon-return-retry')).textContent).toContain(
            'Reintentar el pago'
        );
        expect(screen.getByTestId('addon-return-other-email').textContent).toContain(
            'Usar otro mail'
        );
        expect(screen.queryByTestId('addon-return-start-new')).toBeNull();
    });

    it('«Reintentar el pago» re-sends the identity without a payer email and opens the same checkout', async () => {
        // Arrange
        const { navigate } = back(pending);

        // Act
        fireEvent.click(await screen.findByTestId('addon-return-retry'));

        // Assert
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(checkoutUrl));
        expect(purchase).toHaveBeenCalledTimes(1);
        const body = purchase.mock.calls[0]?.[0].body;
        expect(body).toEqual({
            productId,
            targetId,
            addonVersionId: versionId,
            orderRequestId: freshId
        });
        // A fresh order id routes it through the provider read; the return id would replay.
        expect(body.orderRequestId).not.toBe(returnId);
        expect(body).not.toHaveProperty('payerEmail');
    });

    it('«Reintentar el pago» on a purchase already paid says so and never redirects to pay', async () => {
        // Arrange
        purchase.mockResolvedValue({
            ok: false,
            error: { code: 'ADDON_ALREADY_ACTIVE', reason: 'ALREADY_ACTIVE', status: 409 }
        });
        const { navigate } = back(pending);

        // Act
        fireEvent.click(await screen.findByTestId('addon-return-retry'));

        // Assert
        expect((await screen.findByTestId('addon-return-notice')).textContent).toContain(
            'ya registró tu pago'
        );
        expect(navigate).not.toHaveBeenCalled();
        expect(screen.queryByTestId('addon-return-error')).toBeNull();
    });

    it('«Usar otro mail» asks for the email, validates it, and posts it under a new order id', async () => {
        // Arrange
        purchase.mockResolvedValue({
            ok: true,
            data: {
                outcome: 'CREATED',
                instanceId: freshId,
                chargeKind: 'PERIODICO',
                processing: false,
                checkoutUrl: `${checkoutUrl}-new`
            }
        });
        const { navigate } = back(pending);
        fireEvent.click(await screen.findByTestId('addon-return-other-email'));
        const field = screen.getByTestId('addon-return-email') as HTMLInputElement;
        expect(field.value).toBe('');
        // The button unmounted itself: focus moved to the field it opened, not to the body.
        expect(document.activeElement).toBe(field);

        // Act: an invalid email is refused before anything is sent.
        fireEvent.change(field, { target: { value: 'not-an-email' } });
        fireEvent.click(screen.getByTestId('addon-return-email-confirm'));

        // Assert: the message is the field's own error, wired to the input; no alert.
        await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
        const describedBy = field.getAttribute('aria-describedby') ?? '';
        const fieldError = describedBy
            .split(' ')
            .map((idRef) => document.getElementById(idRef))
            .find((node) => node?.textContent?.includes('Ingresá un correo válido del pagador.'));
        expect(fieldError).toBeTruthy();
        expect(screen.queryByTestId('addon-return-error')).toBeNull();
        expect(purchase).not.toHaveBeenCalled();

        // Act: a valid one builds the new checkout.
        fireEvent.change(field, { target: { value: 'other@example.test' } });
        fireEvent.click(screen.getByTestId('addon-return-email-confirm'));

        // Assert
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${checkoutUrl}-new`));
        expect(purchase.mock.calls[0]?.[0].body).toEqual({
            productId,
            targetId,
            addonVersionId: versionId,
            orderRequestId: freshId,
            payerEmail: 'other@example.test'
        });
    });
});

describe('HOS-2680 return actions: closed recurring purchase', () => {
    it('never offers «Reintentar el pago»; offers «Empezar una compra nueva» with the account email', async () => {
        back(closed);
        expect((await screen.findByTestId('addon-return-start-new')).textContent).toContain(
            'Empezar una compra nueva'
        );
        expect(screen.queryByTestId('addon-return-retry')).toBeNull();
        expect(screen.queryByTestId('addon-return-other-email')).toBeNull();
        expect((screen.getByTestId('addon-return-email') as HTMLInputElement).value).toBe(
            'owner@example.test'
        );
    });

    it('starts a new purchase of the same add-on with the (editable) payer email', async () => {
        // Arrange
        const { navigate } = back(closed);
        fireEvent.change(await screen.findByTestId('addon-return-email'), {
            target: { value: 'edited@example.test' }
        });

        // Act
        fireEvent.click(screen.getByTestId('addon-return-start-new'));

        // Assert
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(checkoutUrl));
        expect(purchase.mock.calls[0]?.[0].body).toEqual({
            productId,
            targetId,
            addonVersionId: versionId,
            orderRequestId: freshId,
            payerEmail: 'edited@example.test'
        });
    });

    it('a refused new purchase shows the API message and a link back to the store', async () => {
        // Arrange
        purchase.mockResolvedValue({
            ok: false,
            error: {
                code: 'ADDON_VERSION_NOT_CURRENT',
                reason: 'ADDON_VERSION_NOT_CURRENT',
                message: 'Este complemento ya no está a la venta.',
                status: 409
            }
        });
        const { navigate } = back(closed);

        // Act
        fireEvent.click(await screen.findByTestId('addon-return-start-new'));

        // Assert
        // The refusal reaches the owner as its localized copy, never as a raw code.
        expect((await screen.findByTestId('addon-return-error')).textContent).toBe(
            'El precio o las condiciones de este complemento cambiaron. Recargá la página para ver la versión actual.'
        );
        const store = screen.getByTestId('addon-return-store') as HTMLAnchorElement;
        expect(store.getAttribute('href')).toContain('/es/mi-cuenta/suscripcion');
        expect(store.textContent).toBe('Volver a la tienda');
        expect(navigate).not.toHaveBeenCalled();
    });
});

describe('HOS-2680 return actions: ADDON_ALREADY_ACTIVE on a closed purchase', () => {
    it('shows the translated API error, not the «already paid» copy', async () => {
        // Arrange: another active instance of the same add-on holds the identity.
        purchase.mockResolvedValue({
            ok: false,
            error: { code: 'ADDON_ALREADY_ACTIVE', reason: 'ALREADY_ACTIVE', status: 409 }
        });
        const { navigate } = back(closed);

        // Act
        fireEvent.click(await screen.findByTestId('addon-return-start-new'));

        // Assert
        const alert = await screen.findByTestId('addon-return-error');
        expect(alert.getAttribute('role')).toBe('alert');
        expect(alert.textContent).toBe(
            'Ya tenés este complemento activo. No hace falta comprarlo de nuevo.'
        );
        expect(screen.queryByTestId('addon-return-notice')).toBeNull();
        expect(screen.getByTestId('addon-return-store')).toBeTruthy();
        expect(navigate).not.toHaveBeenCalled();
    });
});

describe('HOS-2680 return actions: one-time purchases keep their flow', () => {
    it.each([pending, closed])('shows no return action for a one-time purchase', async (read) => {
        back({ ...read, chargeKind: 'UNA_VEZ' });
        await waitFor(() => expect(readPurchase).toHaveBeenCalled());
        expect(screen.queryByTestId('addon-return-actions')).toBeNull();
    });
});
