/**
 * Pure decisions of the actions the add-on purchase screen offers when the owner comes back from
 * Mercado Pago (HOS-2680). Only a recurring (`PERIODICO`) purchase gets actions; a one-time page
 * purchase keeps its own flow.
 */
import type { AddonPurchaseReadResponseSchema, AddonPurchaseRequestSchema } from '@repo/schemas';
import type { z } from 'zod';

type PurchaseRead = z.infer<typeof AddonPurchaseReadResponseSchema>;
type PurchaseRequest = z.input<typeof AddonPurchaseRequestSchema>;

/** Store page the screen links back to when a new purchase cannot be started. */
export const ADDON_STORE_PATH = 'mi-cuenta/suscripcion';

/**
 * Which actions a read purchase offers:
 *
 * - `PENDING`: a recurring checkout still waiting. «Reintentar el pago» and «Usar otro mail».
 * - `CLOSED`: a recurring purchase that ended without activating. Only «Empezar una compra
 *   nueva». After a declined first charge Mercado Pago cancels the preapproval, so a closed
 *   purchase never offers the retry of its old checkout.
 * - `null`: nothing to offer (no read yet, active, or a one-time purchase).
 *
 * @param input.read - The last owner-only read of the purchase, if any
 * @returns The action set, or null
 */
export function returnActionsFor(input: {
    readonly read: PurchaseRead | null;
}): 'PENDING' | 'CLOSED' | null {
    const { read } = input;
    if (read?.chargeKind !== 'PERIODICO') return null;
    if (read.status === 'PENDING_AUTHORIZATION') return 'PENDING';
    if (read.status === 'ACTIVE') return null;
    return 'CLOSED';
}

/**
 * The purchase request an action sends: the read purchase identity under a FRESH order id.
 *
 * The fresh id is what makes the API decide on the purchase that holds the identity (HOS-2668)
 * instead of replaying the stored link: it re-reads the preapproval first, so a checkout the
 * owner already paid answers `ADDON_ALREADY_ACTIVE` and never a link to pay again.
 *
 * «Reintentar el pago» MUST omit `payerEmail`: the API compares it with the email declared on the
 * pending purchase, and any difference releases that purchase and creates another one. Without
 * it the same checkout is reused. «Usar otro mail» and «Empezar una compra nueva» send it.
 *
 * @param input.read - The purchase identity, as read
 * @param input.orderRequestId - A freshly minted order id, never the one being read
 * @param input.payerEmail - The payer email, only for a new checkout
 * @returns The request body
 */
export function returnPurchaseBody(input: {
    readonly read: Pick<PurchaseRead, 'productId' | 'targetId' | 'addonVersionId'>;
    readonly orderRequestId: string;
    readonly payerEmail?: string;
}): PurchaseRequest {
    return {
        productId: input.read.productId,
        targetId: input.read.targetId,
        addonVersionId: input.read.addonVersionId,
        orderRequestId: input.orderRequestId,
        ...(input.payerEmail ? { payerEmail: input.payerEmail } : {})
    };
}
