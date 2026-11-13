import { addonInstances, addonProducts, and, eq, getDb } from '@repo/db';
import { z } from 'zod';

const inputSchema = z.strictObject({
    ownerId: z.uuid(),
    orderRequestId: z.string().min(1).max(64)
});

/** Reads one purchase by request identity and owner without exposing another owner's row. */
export async function readAddonPurchase(input: {
    readonly ownerId: string;
    readonly orderRequestId: string;
}) {
    const { ownerId, orderRequestId } = inputSchema.parse(input);
    const [row] = await getDb()
        .select({
            instanceId: addonInstances.id,
            status: addonInstances.status,
            chargeKind: addonProducts.chargeKind
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .where(
            and(
                eq(addonInstances.ownerId, ownerId),
                eq(addonInstances.orderRequestId, orderRequestId)
            )
        )
        .limit(1);
    if (!row) return null;
    return { ...row, processing: row.status === 'PENDING_AUTHORIZATION' };
}
