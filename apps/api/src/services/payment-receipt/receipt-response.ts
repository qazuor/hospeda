/**
 * Turns a receipt into the HTTP response the browser saves (HOS-2566).
 *
 * A receipt names a private individual, so the response is never cacheable by a
 * shared cache and the file is regenerated from the row on every request.
 *
 * @module services/payment-receipt/receipt-response
 */

import type { ReceiptDetails } from './receipt-details-read.js';
import type { OwnReceipt } from './receipt-read.js';
import { renderReceiptPdf } from './receipt-render.js';

/**
 * Renders a receipt and wraps it in a downloadable response.
 *
 * `inline`, not `attachment`: the page behind the "Ver recibo" button opens the
 * file, and the browser's own viewer offers the download.
 *
 * @param input.receipt - The receipt to render.
 * @param input.details - What else is known about the payment (HOS-2682).
 * @returns A `Response` carrying `application/pdf`.
 */
export async function buildReceiptResponse(input: {
    readonly receipt: OwnReceipt;
    readonly details?: ReceiptDetails;
}): Promise<Response> {
    const pdf = await renderReceiptPdf({ receipt: input.receipt, details: input.details });
    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="comprobante-${input.receipt.receiptNumber}.pdf"`,
            'Content-Length': String(pdf.byteLength),
            'Cache-Control': 'private, no-store'
        }
    });
}
