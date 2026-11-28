import { describe, expect, it } from 'vitest';
import {
    ADDON_STORE_PATH,
    returnActionsFor,
    returnPurchaseBody
} from '@/lib/billing/addon-purchase-return-actions';

const id = '123e4567-e89b-42d3-a456-426614174001';
const read = {
    instanceId: id,
    status: 'PENDING_AUTHORIZATION' as const,
    chargeKind: 'PERIODICO' as const,
    processing: true,
    productId: id,
    targetId: null,
    addonVersionId: id
};

describe('HOS-2680 return actions of an add-on purchase', () => {
    it('offers the pending actions only for a waiting recurring purchase', () => {
        expect(returnActionsFor({ read })).toBe('PENDING');
    });

    it.each([
        'ABANDONED',
        'EXPIRED',
        'CANCELLED'
    ] as const)('a closed (%s) recurring purchase only offers a new purchase, never the retry', (status) => {
        expect(returnActionsFor({ read: { ...read, status, processing: false } })).toBe('CLOSED');
    });

    it('offers nothing without a read, for an active purchase or a one-time one', () => {
        expect(returnActionsFor({ read: null })).toBeNull();
        expect(returnActionsFor({ read: { ...read, status: 'ACTIVE' } })).toBeNull();
        expect(returnActionsFor({ read: { ...read, chargeKind: 'UNA_VEZ' } })).toBeNull();
        expect(
            returnActionsFor({ read: { ...read, chargeKind: 'UNA_VEZ', status: 'EXPIRED' } })
        ).toBeNull();
    });

    it('the retry body carries the identity under the new order id and no payer email', () => {
        // Act
        const body = returnPurchaseBody({ read, orderRequestId: 'fresh' });

        // Assert
        expect(body).toEqual({
            productId: id,
            targetId: null,
            addonVersionId: id,
            orderRequestId: 'fresh'
        });
        expect(body).not.toHaveProperty('payerEmail');
    });

    it('a new checkout body carries the payer email', () => {
        expect(
            returnPurchaseBody({ read, orderRequestId: 'fresh', payerEmail: 'a@example.test' })
        ).toMatchObject({ orderRequestId: 'fresh', payerEmail: 'a@example.test' });
    });

    it('links back to the subscription store', () => {
        expect(ADDON_STORE_PATH).toBe('mi-cuenta/suscripcion');
    });
});
