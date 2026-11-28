/**
 * What the receipt PDF says (HOS-2682): every piece of data that is known and
 * true of the payment, and nothing printed for what is not.
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
    type ReceiptDetails,
    resolveReceiptPaymentMethod,
    resolveReceiptPeriod
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
    promoCodes: ['LITORAL15', 'BIENVENIDA'],
    planTrusted: true
};

describe('buildReceiptContent', () => {
    it('words every known field of a Mercado Pago payment with promos', () => {
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
            amount: '$15.300,00'
        });
        expect(content.total).toEqual({ label: 'Total pagado', value: '$15.300,00' });
        expect(content.payment).toEqual([
            { label: 'Método', value: 'Mercado Pago' },
            { label: 'N.º de operación', value: '134567890123' },
            { label: 'Promoción aplicada', value: 'LITORAL15, BIENVENIDA' },
            { label: 'Moneda', value: 'Pesos argentinos (ARS)' }
        ]);
        expect(content.contact).toEqual([
            'info@hospeda.com.ar',
            '+54 3442 470650',
            'www.hospeda.com.ar'
        ]);
    });

    it('never invents a subtotal or discount amount: nothing stores the price of that day', () => {
        const content = buildReceiptContent({ receipt, details });
        expect(JSON.stringify(content)).not.toMatch(/Subtotal|Descuento/);
    });

    it('prints a manual payment with its reference and no amount, which it does not store', () => {
        const content = buildReceiptContent({
            receipt: { ...receipt, amountMinor: null, currency: null },
            details: { ...details, method: 'MANUAL', operationId: 'manual-ref', promoCodes: [] }
        });

        expect(content.line.amount).toBeNull();
        expect(content.total).toEqual({ label: 'Pago registrado por Hospeda', value: '' });
        expect(content.payment).toEqual([
            { label: 'Método', value: 'Pago manual registrado por Hospeda' },
            { label: 'Referencia', value: 'manual-ref' }
        ]);
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

    it('leaves out a vertical or cycle it has no name for, falling back to the row name', () => {
        const content = buildReceiptContent({
            receipt,
            details: { ...details, vertical: 'mystery', cycle: 'weekly', productName: null }
        });
        expect(content.line.title).toBe('Suscripción');
        expect(content.line.subtitle).toBe('Plan owner-pro');
    });

    it('prints no plan at all when the plan changed after the payment, not even the row name', () => {
        const content = buildReceiptContent({
            receipt,
            details: { ...details, productName: null, cycle: null, planTrusted: false }
        });
        expect(content.line.subtitle).toBeNull();
        expect(JSON.stringify(content)).not.toContain('owner-pro');
    });

    it('prints no plan from the row when nothing could be read', () => {
        const content = buildReceiptContent({ receipt, details: EMPTY_RECEIPT_DETAILS });
        expect(content.line.subtitle).toBeNull();
        expect(JSON.stringify(content)).not.toContain('owner-pro');
    });

    it('never calls the document an invoice', () => {
        const content = buildReceiptContent({ receipt, details });
        expect(JSON.stringify(content)).not.toMatch(/factura/i);
    });
});

describe('resolveReceiptPaymentMethod', () => {
    it('recognizes Mercado Pago as the provider stores it', () => {
        expect(resolveReceiptPaymentMethod({ provider: 'MERCADO_PAGO', isManual: false })).toBe(
            'MERCADOPAGO'
        );
        expect(resolveReceiptPaymentMethod({ provider: 'mercadopago', isManual: false })).toBe(
            'MERCADOPAGO'
        );
        expect(resolveReceiptPaymentMethod({ provider: 'FAKE', isManual: false })).toBe('OTHER');
        expect(resolveReceiptPaymentMethod({ provider: null, isManual: true })).toBe('MANUAL');
    });
});

describe('resolveReceiptPeriod', () => {
    const periodStart = new Date('2026-11-01T03:00:00.000Z');
    const nextPeriodStart = new Date('2026-12-01T03:00:00.000Z');

    it('ends a period where the next one starts, printing the cycle only when it agrees', () => {
        expect(
            resolveReceiptPeriod({
                periodStart,
                nextPeriodStart,
                cycle: 'monthly',
                planTrusted: true
            })
        ).toEqual({ periodEnd: nextPeriodStart, cycle: 'monthly' });
        // The subscription went annual later: the history wins, today's cycle is dropped.
        expect(
            resolveReceiptPeriod({
                periodStart,
                nextPeriodStart,
                cycle: 'annual',
                planTrusted: true
            })
        ).toEqual({ periodEnd: nextPeriodStart, cycle: null });
    });

    it('does not stretch a period over a gap before the next one', () => {
        expect(
            resolveReceiptPeriod({
                periodStart,
                nextPeriodStart: new Date('2027-03-01T03:00:00.000Z'),
                cycle: 'monthly',
                planTrusted: true
            })
        ).toEqual({ periodEnd: nextPeriodStart, cycle: 'monthly' });
    });

    it("computes the latest period from today's cycle only while the plan is trusted", () => {
        const latest = { periodStart, nextPeriodStart: null, cycle: 'annual' } as const;
        expect(resolveReceiptPeriod({ ...latest, planTrusted: true })).toEqual({
            periodEnd: new Date('2027-11-01T03:00:00.000Z'),
            cycle: 'annual'
        });
        expect(resolveReceiptPeriod({ ...latest, planTrusted: false })).toEqual({
            periodEnd: null,
            cycle: null
        });
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
        expect(computeReceiptPeriodEnd({ periodStart: new Date(), cycle: 'weekly' })).toBeNull();
        expect(computeReceiptPeriodEnd({ periodStart: null, cycle: 'monthly' })).toBeNull();
    });
});
