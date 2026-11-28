/**
 * What the receipt PDF says (HOS-2682): every piece of data that is known, and
 * nothing printed for what is not.
 */

import { describe, expect, it } from 'vitest';
import {
    buildReceiptContent,
    formatReceiptAmount,
    formatReceiptPeriod
} from '../../../src/services/payment-receipt/receipt-content.js';
import {
    computeReceiptPeriodEnd,
    EMPTY_RECEIPT_DETAILS,
    type ReceiptDetails
} from '../../../src/services/payment-receipt/receipt-details-read.js';
import type { OwnReceipt } from '../../../src/services/payment-receipt/receipt-read.js';

const receipt: OwnReceipt = {
    id: '11111111-1111-4111-8111-111111111111',
    receiptNumber: 42,
    issuedAt: new Date('2026-11-07T15:00:00.000Z'),
    payerName: 'María Ñandú',
    payerEmail: 'maria@example.com',
    amountMinor: 1530000,
    currency: 'ARS',
    concept: { kind: 'PLAN', name: 'owner-pro' }
};

const details: ReceiptDetails = {
    accountName: 'Estancia El Carpincho',
    accountEmail: 'reservas@carpincho.test',
    vertical: 'accommodation',
    productName: 'Pro',
    cycle: 'monthly',
    periodStart: new Date('2026-11-07T03:00:00.000Z'),
    periodEnd: new Date('2026-12-07T03:00:00.000Z'),
    method: 'MERCADOPAGO',
    operationId: '134567890123',
    paidAt: new Date('2026-11-07T14:58:00.000Z'),
    listAmountMinor: 1800000,
    listCurrency: 'ARS',
    promoCode: 'LITORAL15'
};

describe('buildReceiptContent', () => {
    it('words every known field of a Mercado Pago payment with a promo', () => {
        // Arrange / Act
        const content = buildReceiptContent({ receipt, details });

        // Assert
        expect(content.numberLabel).toBe('N.º 000042');
        expect(content.paidBy).toEqual(['María Ñandú', 'maria@example.com']);
        expect(content.account).toEqual(['Estancia El Carpincho', 'reservas@carpincho.test']);
        expect(content.meta).toEqual([
            { label: 'Número', value: '000042' },
            { label: 'Fecha de emisión', value: '07/11/2026' },
            { label: 'Fecha de pago', value: '07/11/2026' }
        ]);
        expect(content.line).toEqual({
            title: 'Suscripción · Alojamiento',
            subtitle: 'Plan Pro · Ciclo mensual',
            period: '07/11/2026 al 06/12/2026',
            amount: '$18.000,00'
        });
        expect(content.breakdown).toEqual([
            { label: 'Subtotal', value: '$18.000,00' },
            { label: 'Descuento (LITORAL15)', value: '-$2.700,00' }
        ]);
        expect(content.total).toEqual({ label: 'Total pagado', value: '$15.300,00' });
        expect(content.payment).toEqual([
            { label: 'Método', value: 'Mercado Pago' },
            { label: 'N.º de operación', value: '134567890123' },
            { label: 'Moneda', value: 'Pesos argentinos (ARS)' }
        ]);
        expect(content.contact).toEqual([
            'info@hospeda.com.ar',
            '+54 3442 470650',
            'www.hospeda.com.ar'
        ]);
    });

    it('prints a manual payment with its reference and no amount, which it does not store', () => {
        const content = buildReceiptContent({
            receipt: { ...receipt, amountMinor: null, currency: null },
            details: {
                ...details,
                method: 'MANUAL',
                operationId: 'manual-ref',
                listAmountMinor: 1800000,
                promoCode: null
            }
        });

        expect(content.line.amount).toBeNull();
        expect(content.breakdown).toEqual([]);
        expect(content.total).toEqual({ label: 'Pago registrado por Hospeda', value: '' });
        expect(content.payment).toEqual([
            { label: 'Método', value: 'Pago manual registrado por Hospeda' },
            { label: 'Referencia', value: 'manual-ref' }
        ]);
    });

    it('shows no discount without a promo, nor when the list price is in another currency or not higher', () => {
        const noPromo = buildReceiptContent({ receipt, details: { ...details, promoCode: null } });
        const otherCurrency = buildReceiptContent({
            receipt,
            details: { ...details, listCurrency: 'USD' }
        });
        const notHigher = buildReceiptContent({
            receipt,
            details: { ...details, listAmountMinor: 1530000 }
        });

        for (const content of [noPromo, otherCurrency, notHigher]) {
            expect(content.breakdown).toEqual([]);
            expect(content.line.amount).toBe('$15.300,00');
            expect(content.total.value).toBe('$15.300,00');
        }
    });

    it('does not repeat the account when it is the payer', () => {
        const content = buildReceiptContent({
            receipt,
            details: { ...details, accountName: 'María Ñandú', accountEmail: 'maria@example.com' }
        });
        expect(content.account).toEqual([]);
    });

    it('survives a receipt with nothing but its row, printing no placeholder', () => {
        const content = buildReceiptContent({
            receipt: {
                ...receipt,
                payerName: '  ',
                payerEmail: null,
                concept: { kind: 'ADDON', name: null }
            },
            details: EMPTY_RECEIPT_DETAILS
        });

        expect(content.paidBy).toEqual([]);
        expect(content.account).toEqual([]);
        expect(content.line).toEqual({
            title: 'Complemento',
            subtitle: null,
            period: null,
            amount: '$15.300,00'
        });
        expect(content.payment).toEqual([{ label: 'Moneda', value: 'Pesos argentinos (ARS)' }]);
        expect(JSON.stringify(content)).not.toMatch(/undefined|NaN|"null"/);
    });

    it('leaves out a vertical or cycle it has no name for', () => {
        const content = buildReceiptContent({
            receipt,
            details: { ...details, vertical: 'mystery', cycle: 'weekly', productName: null }
        });
        expect(content.line.title).toBe('Suscripción');
        // The receipt's own concept name is the fallback when no display name was read.
        expect(content.line.subtitle).toBe('Plan owner-pro');
    });

    it('never calls the document an invoice', () => {
        const content = buildReceiptContent({ receipt, details });
        expect(JSON.stringify(content)).not.toMatch(/factura/i);
    });
});

describe('formatting helpers', () => {
    it('formats integer centavos the way the email does', () => {
        expect(formatReceiptAmount({ amountMinor: 1800000, currency: 'ARS' })).toBe('$18.000,00');
        expect(formatReceiptAmount({ amountMinor: 1050, currency: 'USD' })).toBe('USD 10,50');
    });

    it('prints the last covered day of an exclusive period end', () => {
        expect(
            formatReceiptPeriod({
                start: new Date('2026-11-01T03:00:00.000Z'),
                end: new Date('2027-11-01T03:00:00.000Z')
            })
        ).toBe('01/11/2026 al 31/10/2027');
        expect(
            formatReceiptPeriod({ start: new Date('2026-11-01T03:00:00.000Z'), end: null })
        ).toBe('01/11/2026');
        expect(formatReceiptPeriod({ start: null, end: null })).toBeNull();
    });

    it('derives the period end from the cycle, clamping the day of month', () => {
        expect(
            computeReceiptPeriodEnd({
                periodStart: new Date('2026-01-31T12:00:00.000Z'),
                cycle: 'monthly'
            })?.toISOString()
        ).toBe('2026-02-28T12:00:00.000Z');
        expect(
            computeReceiptPeriodEnd({
                periodStart: new Date('2026-11-01T03:00:00.000Z'),
                cycle: 'quarterly'
            })?.toISOString()
        ).toBe('2027-02-01T03:00:00.000Z');
        expect(computeReceiptPeriodEnd({ periodStart: new Date(), cycle: 'weekly' })).toBeNull();
        expect(computeReceiptPeriodEnd({ periodStart: null, cycle: 'monthly' })).toBeNull();
    });
});
