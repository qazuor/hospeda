/**
 * The payment receipts of the authenticated account (HOS-2566).
 *
 * ```
 * GET /api/v1/protected/billing-subscription/receipts
 * GET /api/v1/protected/billing-subscription/receipts/{receiptId}/pdf
 * ```
 *
 * The decision behind these routes (owner, 26/11/2026): the receipt is an
 * authenticated link, not an email attachment. The "Recibimos tu pago" mail and
 * the account's "Ver recibo" button both lead here, and the session is what
 * authorizes the read.
 *
 * Order of the checks: session (401), `BILLING_VIEW_OWN` (403), input shape
 * (400), ownership (404). A receipt that belongs to somebody else answers the
 * same 404 as one that does not exist, because a 403 would confirm that the id
 * exists (`apps/api/docs/error-contract.md`). The ownership test lives in the
 * query ({@link readOwnReceipt}), not after it.
 *
 * @module routes/billing-subscription/receipts
 */

import { createLogger } from '@repo/logger';
import { OwnReceiptsResponseSchema, PermissionEnum } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import {
    EMPTY_RECEIPT_DETAILS,
    type ReceiptDetails,
    readReceiptDetails
} from '../../services/payment-receipt/receipt-details-read';
import {
    listOwnReceipts,
    type OwnReceipt,
    readOwnReceipt
} from '../../services/payment-receipt/receipt-read';
import { buildReceiptResponse } from '../../services/payment-receipt/receipt-response';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';

const logger = createLogger('own-receipts');

/**
 * Reads what the document prints beyond the receipt row (HOS-2682). A failure
 * here degrades the document to the receipt row alone instead of failing the
 * download: the owner still gets a valid receipt, and the log says why it is
 * thinner than usual.
 */
async function detailsOrEmpty(receipt: OwnReceipt): Promise<ReceiptDetails> {
    try {
        return await readReceiptDetails({ receipt });
    } catch (error) {
        logger.warn(
            {
                receiptId: receipt.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'Receipt details could not be read; rendering the receipt row alone'
        );
        return EMPTY_RECEIPT_DETAILS;
    }
}

/** List the receipts the authenticated account owns, newest first. */
export const protectedListOwnReceiptsRoute = createProtectedRoute({
    method: 'get',
    path: '/receipts',
    summary: 'List own payment receipts',
    description: 'Returns the payment receipts owned by the authenticated account, newest first.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    responseSchema: OwnReceiptsResponseSchema,
    handler: async (ctx) => {
        const receipts = await listOwnReceipts({ userId: getActorFromContext(ctx).id });
        return {
            receipts: receipts.map((receipt) => ({
                id: receipt.id,
                receiptNumber: receipt.receiptNumber,
                issuedAt: receipt.issuedAt.toISOString(),
                amountMinor: receipt.amountMinor,
                currency: receipt.currency,
                conceptKind: receipt.concept.kind,
                conceptName: receipt.concept.name
            }))
        };
    }
});

/**
 * Download one receipt as a PDF. Returns a raw `Response`, so the schema
 * machinery validates nothing here and the tests assert the header pair and the
 * PDF magic bytes directly.
 */
export const protectedGetOwnReceiptPdfRoute = createProtectedRoute({
    method: 'get',
    path: '/receipts/{receiptId}/pdf',
    summary: 'Download own payment receipt',
    description:
        'Returns the PDF of one payment receipt owned by the authenticated account. Any other receipt answers 404.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    requestParams: { receiptId: z.string().uuid() },
    responseSchema: z.null(),
    handler: async (ctx, params): Promise<Response> => {
        const receipt = await readOwnReceipt({
            receiptId: params.receiptId as string,
            userId: getActorFromContext(ctx).id
        });
        if (!receipt) throw entityNotFoundError({ entityName: 'Receipt' });
        return buildReceiptResponse({ receipt, details: await detailsOrEmpty(receipt) });
    },
    options: { customRateLimit: { requests: 30, windowMs: 60_000 } }
});
