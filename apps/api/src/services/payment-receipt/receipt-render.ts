/**
 * Lays a payment receipt out on one portrait A4 page (HOS-2566).
 *
 * The mechanism is the one every printable this API emits uses: `pdf-lib`, one
 * page, the standard faces. `toDrawableText` and `wrapText` are IMPORTED from the
 * brochure renderer, not copied: the WinAnsi substitution rule is a correctness
 * property (a payer name the face cannot encode would raise inside `pdf-lib` and
 * answer a 500 to a download).
 *
 * The document is NOT a tax invoice and says so on its face, in the same words
 * as the "Recibimos tu pago" email.
 *
 * Determinism: same receipt, same bytes. Nothing reads the clock; the document
 * dates are pinned to the epoch.
 *
 * Copy is Spanish only, like the notice the link comes from: this is a document
 * for the Argentine market and the mail that points at it has no other locale.
 *
 * @module services/payment-receipt/receipt-render
 */

import { PageSizes, PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { toDrawableText, wrapText } from '../listing-brochure/brochure-render.js';
import type { OwnReceipt } from './receipt-read.js';

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT = rgb(0.08, 0.22, 0.25);
const BODY_FG = rgb(0.13, 0.13, 0.13);
const MUTED_FG = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.8, 0.8, 0.8);
const LEADING = 1.4;

/** Non-fiscal notice, identical in wording to the email's. */
export const RECEIPT_NON_FISCAL_NOTICE =
    'Este comprobante es no fiscal: no es una factura. Sirve como constancia de tu pago.';

/** Formats minor units the way the email does: `$1.500,00`. */
export function formatReceiptAmount(input: {
    readonly amountMinor: number;
    readonly currency: string;
}): string {
    const formatted = (input.amountMinor / 100).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const symbol = input.currency === 'ARS' ? '$' : `${input.currency} `;
    return `${symbol}${formatted}`;
}

/** `26/11/2026`, in Argentina's zone so the date matches the one in the email. */
export function formatReceiptDate(input: { readonly date: Date }): string {
    return input.date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

/** The rows of the detail block, in print order. */
export function buildReceiptRows(input: {
    readonly receipt: OwnReceipt;
}): ReadonlyArray<{ readonly label: string; readonly value: string }> {
    const { receipt } = input;
    const rows: Array<{ label: string; value: string }> = [
        { label: 'Fecha', value: formatReceiptDate({ date: receipt.issuedAt }) }
    ];
    if (receipt.payerName) rows.push({ label: 'Pagador', value: receipt.payerName });
    if (receipt.payerEmail) rows.push({ label: 'Correo', value: receipt.payerEmail });
    const subject = receipt.concept.kind === 'ADDON' ? 'Complemento' : 'Suscripción';
    rows.push({
        label: 'Concepto',
        value: receipt.concept.name ? `${subject}: ${receipt.concept.name}` : subject
    });
    if (receipt.amountMinor !== null && receipt.currency !== null) {
        rows.push({
            label: 'Monto',
            value: formatReceiptAmount({
                amountMinor: receipt.amountMinor,
                currency: receipt.currency
            })
        });
    }
    return rows;
}

function drawText(input: {
    readonly page: ReturnType<PDFDocument['addPage']>;
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly font: PDFFont;
    readonly size: number;
    readonly color: ReturnType<typeof rgb>;
}): void {
    input.page.drawText(toDrawableText({ text: input.text, font: input.font }), {
        x: input.x,
        y: PAGE_HEIGHT - input.y,
        size: input.size,
        font: input.font,
        color: input.color
    });
}

/**
 * Renders a receipt as a PDF.
 *
 * @param input.receipt - The receipt to print.
 * @returns The complete PDF file.
 */
export async function renderReceiptPdf(input: {
    readonly receipt: OwnReceipt;
}): Promise<Uint8Array<ArrayBuffer>> {
    const { receipt } = input;
    const doc = await PDFDocument.create();
    doc.setTitle(`Comprobante n.º ${receipt.receiptNumber}`);
    doc.setProducer('Hospeda');
    doc.setCreator('Hospeda');
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    let y = MARGIN + 24;
    drawText({ page, text: 'Hospeda', x: MARGIN, y, font: bold, size: 22, color: ACCENT });
    y += 44;
    drawText({
        page,
        text: `Comprobante de pago n.º ${receipt.receiptNumber}`,
        x: MARGIN,
        y,
        font: bold,
        size: 18,
        color: BODY_FG
    });
    y += 18;
    page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - y },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - y },
        thickness: 1,
        color: RULE
    });
    y += 30;

    const labelWidth = 90;
    for (const row of buildReceiptRows({ receipt })) {
        drawText({ page, text: row.label, x: MARGIN, y, font: bold, size: 11, color: MUTED_FG });
        const lines = wrapText({
            text: row.value,
            font: regular,
            size: 12,
            maxWidth: CONTENT_WIDTH - labelWidth
        });
        for (const line of lines.length > 0 ? lines : ['']) {
            drawText({
                page,
                text: line,
                x: MARGIN + labelWidth,
                y,
                font: regular,
                size: 12,
                color: BODY_FG
            });
            y += 12 * LEADING;
        }
        y += 8;
    }

    y += 16;
    for (const line of wrapText({
        text: RECEIPT_NON_FISCAL_NOTICE,
        font: regular,
        size: 10,
        maxWidth: CONTENT_WIDTH
    })) {
        drawText({ page, text: line, x: MARGIN, y, font: regular, size: 10, color: MUTED_FG });
        y += 10 * LEADING;
    }

    // A fresh, ArrayBuffer-backed copy: `Response` wants a BufferSource.
    return new Uint8Array(await doc.save());
}
