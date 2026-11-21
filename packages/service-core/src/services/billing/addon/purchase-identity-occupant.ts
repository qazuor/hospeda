import {
    addonInstances,
    and,
    eq,
    getDb,
    isNotNull,
    isNull,
    or,
    type SelectAddonInstance
} from '@repo/db';

/** The purchase identity a request asks for: one live addon per (owner, product, target). */
export interface PurchaseIdentity {
    readonly ownerId: string;
    readonly productId: string;
    readonly targetId: string | null;
}

/**
 * Reads the committed purchase that holds an identity under `uq_addon_instance_purchase_identity`:
 * a purchase waiting for payment, or an active one with a complement. It reads outside any
 * transaction, so a purchase another request inserted but has not committed yet is not seen.
 *
 * @param input.identity - The owner, product and target the request asks for
 * @returns The occupant, or `{ occupant: null }` when no committed purchase holds the identity
 */
export async function readIdentityOccupant(input: {
    readonly identity: PurchaseIdentity;
}): Promise<{ readonly occupant: SelectAddonInstance | null }> {
    const { identity } = input;
    const [occupant] = await getDb()
        .select()
        .from(addonInstances)
        .where(
            and(
                eq(addonInstances.ownerId, identity.ownerId),
                eq(addonInstances.productId, identity.productId),
                identity.targetId === null
                    ? isNull(addonInstances.targetId)
                    : eq(addonInstances.targetId, identity.targetId),
                or(
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                    and(
                        eq(addonInstances.status, 'ACTIVE'),
                        isNotNull(addonInstances.complementSubscriptionId)
                    )
                )
            )
        )
        .limit(1);
    return { occupant: occupant ?? null };
}
