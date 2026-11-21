import { addonInstances, addonProducts, and, eq, getDb } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import type { ConfirmOneTimePagePaymentPorts } from './addon-instance-a2-one-time-page';
import { confirmOneTimePageByReference } from './confirm-one-time-page-by-reference';

const logger = createLogger('addon-purchase-read');

const inputSchema = z.strictObject({
    ownerId: z.uuid(),
    orderRequestId: z.string().min(1).max(64)
});

async function readRow(input: { readonly ownerId: string; readonly orderRequestId: string }) {
    const [row] = await getDb()
        .select({
            instanceId: addonInstances.id,
            status: addonInstances.status,
            chargeKind: addonProducts.chargeKind,
            paymentPageId: addonInstances.paymentPageId
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .where(
            and(
                eq(addonInstances.ownerId, input.ownerId),
                eq(addonInstances.orderRequestId, input.orderRequestId)
            )
        )
        .limit(1);
    return row;
}

/**
 * Reads one purchase by request identity and owner without exposing another owner's row.
 *
 * With `ports`, a one-time page purchase that is still waiting is first confirmed against the
 * provider (HOS-2179 §5.3 path 2, the return re-read): its payments are searched by reference
 * and each id is re-read by id before A2 decides. The return URL's parameters are never read;
 * they only make the screen ask. A provider that does not answer leaves the purchase as stored.
 *
 * @param input.ownerId - The owner asking; another owner's purchase reads as absent
 * @param input.orderRequestId - The purchase identity the screen minted
 * @param ports - A2's ports, to confirm a waiting page purchase before answering
 * @returns The purchase with `processing` while it waits, or null when this owner has none
 */
export async function readAddonPurchase(
    input: { readonly ownerId: string; readonly orderRequestId: string },
    ports?: ConfirmOneTimePagePaymentPorts
) {
    const request = inputSchema.parse(input);
    let row = await readRow(request);
    if (!row) return null;
    // Only a one-time page purchase has a page id, so no charge-kind test is needed; a purchase
    // that stopped waiting is answered as SETTLED by the confirmation without a provider call.
    if (ports && row.paymentPageId !== null) {
        try {
            const found = await confirmOneTimePageByReference(
                { instanceId: row.instanceId },
                ports
            );
            if (found === 'ACTIVATED' || found === 'SETTLED') row = (await readRow(request)) ?? row;
        } catch (error) {
            logger.warn(
                {
                    instanceId: row.instanceId,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Return re-read of a one-time page purchase failed; answering the stored state'
            );
        }
    }
    const { paymentPageId: _paymentPageId, ...purchase } = row;
    return { ...purchase, processing: purchase.status === 'PENDING_AUTHORIZATION' };
}
