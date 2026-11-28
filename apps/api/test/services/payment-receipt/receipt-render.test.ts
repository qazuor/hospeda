/**
 * The payment receipt PDF (HOS-2566, Hospeda-branded since HOS-2682): what the
 * page draws and that the file is a stable, real PDF.
 */

import { PDFDocument, PDFPage } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECEIPT_NON_FISCAL_NOTICE } from '../../../src/services/payment-receipt/receipt-copy.js';
import type { ReceiptDetails } from '../../../src/services/payment-receipt/receipt-details-read.js';
import type { OwnReceipt } from '../../../src/services/payment-receipt/receipt-read.js';
import { renderReceiptPdf } from '../../../src/services/payment-receipt/receipt-render.js';
import { buildReceiptResponse } from '../../../src/services/payment-receipt/receipt-response.js';

const receipt: OwnReceipt = {
    id: '11111111-1111-4111-8111-111111111111',
    receiptNumber: 42,
    issuedAt: new Date('2026-10-07T15:00:00.000Z'),
    payerName: 'María Ñandú',
    payerEmail: 'maria@example.com',
    amountMinor: 1530000,
    currency: 'ARS',
    concept: { kind: 'PLAN', name: 'owner-pro' }
};

const details: ReceiptDetails = {
    accountName: 'Estancia El Carpincho',
    accountEmail: 'reservas@carpincho.test',
    vertical: 'venue',
    productName: 'Pro',
    cycle: 'annual',
    periodStart: new Date('2026-10-07T03:00:00.000Z'),
    periodEnd: new Date('2027-10-07T03:00:00.000Z'),
    method: 'MERCADOPAGO',
    operationId: '987654321',
    paidAt: new Date('2026-10-07T14:00:00.000Z'),
    promoCodes: ['LITORAL15'],
    planTrusted: true
};

/** Every string the renderer hands to `drawText`, in draw order. */
async function drawnTexts(input: Parameters<typeof renderReceiptPdf>[0]): Promise<string[]> {
    const spy = vi.spyOn(PDFPage.prototype, 'drawText');
    await renderReceiptPdf(input);
    return spy.mock.calls.map(([text]) => text);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('renderReceiptPdf', () => {
    it('draws every field the content carries, branded and with the contact data', async () => {
        const texts = await drawnTexts({ receipt, details });
        const page = texts.join('\n');

        for (const expected of [
            'Hospeda',
            'Turismo en el Litoral',
            'Comprobante de pago',
            'N.º 000042',
            'María Ñandú',
            'maria@example.com',
            'Estancia El Carpincho',
            'reservas@carpincho.test',
            '07/10/2026',
            'Suscripción · Comer y salir',
            'Plan Pro · Ciclo anual',
            '07/10/2026 al 06/10/2027',
            'Promoción aplicada',
            'LITORAL15',
            'Total pagado',
            '$15.300,00',
            'Mercado Pago',
            '987654321',
            'Pesos argentinos (ARS)',
            'Comprobante no fiscal',
            'info@hospeda.com.ar',
            '+54 3442 470650'
        ]) {
            expect(page).toContain(expected);
        }
        expect(texts.join(' ')).toContain(RECEIPT_NON_FISCAL_NOTICE);
        expect(texts.some((text) => /^factura/i.test(text))).toBe(false);
    });

    it('embeds the isotipo as the header image', async () => {
        const spy = vi.spyOn(PDFPage.prototype, 'drawImage');
        await renderReceiptPdf({ receipt, details });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('survives a receipt with no details, no payer and no amount, drawing no placeholder', async () => {
        const texts = await drawnTexts({
            receipt: {
                ...receipt,
                payerName: null,
                payerEmail: null,
                amountMinor: null,
                currency: null,
                concept: { kind: 'ADDON', name: null }
            }
        });
        const page = texts.join('\n');
        expect(page).toContain('Complemento');
        expect(page).toContain('Pago registrado por Hospeda');
        expect(page).not.toMatch(/undefined|null|NaN/);
        expect(page).not.toContain('PAGADO POR');
    });

    it('cuts an over-long payer name instead of running off the page', async () => {
        const texts = await drawnTexts({
            receipt: {
                ...receipt,
                payerName: 'Nombre'.repeat(40),
                payerEmail: `${'x'.repeat(200)}@example.com`
            },
            details
        });
        const nameLines = texts.filter((text) => text.includes('ombreNombre'));
        expect(nameLines.length).toBe(2);
        expect(nameLines.at(-1)?.endsWith('…')).toBe(true);
    });

    it('keeps every line above the footer band, even with every block at its longest', async () => {
        const long = 'Nombre Larguísimo '.repeat(20);
        const spy = vi.spyOn(PDFPage.prototype, 'drawText');
        await renderReceiptPdf({
            receipt: { ...receipt, payerName: long, payerEmail: `${'x'.repeat(200)}@example.com` },
            details: {
                ...details,
                accountName: long,
                accountEmail: `${'y'.repeat(200)}@example.com`,
                productName: long,
                operationId: 'z'.repeat(300),
                promoCodes: Array.from({ length: 30 }, (_, i) => `PROMO${i}`)
            }
        });
        const ys = spy.mock.calls.map(([, options]) => options?.y ?? 0);
        // The last two lines are the footer itself (thanks line + contact band).
        const body = ys.slice(0, -2);
        // Footer band is 44pt tall and the thanks line sits 18pt above it.
        expect(Math.min(...body)).toBeGreaterThan(44 + 18 + 12);
    });

    it('produces a one-page PDF titled with the receipt number', async () => {
        const bytes = await renderReceiptPdf({ receipt, details });
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getTitle()).toBe('Comprobante de pago N.º 000042');
    });

    it('is deterministic for the same receipt and moves with the receipt number', async () => {
        const a = await renderReceiptPdf({ receipt, details });
        const b = await renderReceiptPdf({ receipt, details });
        const c = await renderReceiptPdf({ receipt: { ...receipt, receiptNumber: 43 }, details });
        expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
        expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
    });

    it('renders a payer name the standard face cannot encode without throwing', async () => {
        await expect(
            renderReceiptPdf({ receipt: { ...receipt, payerName: '李小龍 \u{1F600}' }, details })
        ).resolves.toBeInstanceOf(Uint8Array);
    });

    it('states that it is not a tax invoice', () => {
        expect(RECEIPT_NON_FISCAL_NOTICE).toContain('no fiscal');
    });
});

describe('buildReceiptResponse', () => {
    it('is never cacheable and carries the PDF headers', async () => {
        const response = await buildReceiptResponse({ receipt, details });
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('Content-Disposition')).toContain('comprobante-42.pdf');
    });
});
