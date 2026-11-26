/**
 * The payment receipt PDF (HOS-2566): what the rows say and that the file is a
 * stable, real PDF.
 */

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { OwnReceipt } from '../../../src/services/payment-receipt/receipt-read.js';
import {
    buildReceiptRows,
    formatReceiptAmount,
    RECEIPT_NON_FISCAL_NOTICE,
    renderReceiptPdf
} from '../../../src/services/payment-receipt/receipt-render.js';
import { buildReceiptResponse } from '../../../src/services/payment-receipt/receipt-response.js';

const receipt: OwnReceipt = {
    id: '11111111-1111-4111-8111-111111111111',
    receiptNumber: 42,
    issuedAt: new Date('2026-10-07T15:00:00.000Z'),
    payerName: 'María Ñandú',
    payerEmail: 'maria@example.com',
    amountMinor: 1800000,
    currency: 'ARS',
    concept: { kind: 'PLAN', name: 'Básico' }
};

describe('formatReceiptAmount', () => {
    it('formats integer centavos the way the email does', () => {
        expect(formatReceiptAmount({ amountMinor: 1800000, currency: 'ARS' })).toBe('$18.000,00');
    });
});

describe('buildReceiptRows', () => {
    it('lists date, payer, concept and amount in Argentina time', () => {
        const rows = buildReceiptRows({ receipt });
        expect(rows).toEqual([
            { label: 'Fecha', value: '07/10/2026' },
            { label: 'Pagador', value: 'María Ñandú' },
            { label: 'Correo', value: 'maria@example.com' },
            { label: 'Concepto', value: 'Suscripción: Básico' },
            { label: 'Monto', value: '$18.000,00' }
        ]);
    });

    it('leaves the amount out of a manual payment, which stores none', () => {
        const rows = buildReceiptRows({
            receipt: {
                ...receipt,
                amountMinor: null,
                currency: null,
                payerName: null,
                payerEmail: null
            }
        });
        expect(rows.map((r) => r.label)).toEqual(['Fecha', 'Concepto']);
    });

    it('words an add-on receipt as a complement', () => {
        const rows = buildReceiptRows({
            receipt: { ...receipt, concept: { kind: 'ADDON', name: 'Destacado' } }
        });
        expect(rows.find((r) => r.label === 'Concepto')?.value).toBe('Complemento: Destacado');
    });
});

describe('renderReceiptPdf', () => {
    it('produces a one-page PDF titled with the receipt number', async () => {
        const bytes = await renderReceiptPdf({ receipt });
        expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getTitle()).toContain('42');
    });

    it('is deterministic for the same receipt and moves with the receipt number', async () => {
        const a = await renderReceiptPdf({ receipt });
        const b = await renderReceiptPdf({ receipt });
        const c = await renderReceiptPdf({ receipt: { ...receipt, receiptNumber: 43 } });
        expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
        expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
    });

    it('renders a payer name the standard face cannot encode without throwing', async () => {
        await expect(
            renderReceiptPdf({ receipt: { ...receipt, payerName: '李小龍 \u{1F600}' } })
        ).resolves.toBeInstanceOf(Uint8Array);
    });

    it('states that it is not a tax invoice', () => {
        expect(RECEIPT_NON_FISCAL_NOTICE).toContain('no fiscal');
    });
});

describe('buildReceiptResponse', () => {
    it('is never cacheable and carries the PDF headers', async () => {
        const response = await buildReceiptResponse({ receipt });
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/pdf');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        expect(response.headers.get('Content-Disposition')).toContain('comprobante-42.pdf');
    });
});
