import { and, type DrizzleClient, eq, type SelectAddonProduct, subscriptions } from '@repo/db';
import { permanentGrantLiveAnchors } from '../grant/permanent-grant-live-anchors';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger';
import type { AddonScopeType } from './addon-orphanhood';
import type { PurchaseAddonPorts } from './purchase-addon-ports';
import type { PurchaseAddonRefusalReason } from './purchase-addon-types';

/** A1's eligible billing vertical or a closed refusal. */
export type PurchaseTitleResult =
    | { readonly vertical: string }
    | {
          readonly reason: Extract<
              PurchaseAddonRefusalReason,
              'TARGET_NOT_FOUND' | 'NO_VALID_TITLE'
          >;
      };

async function hasTitle(
    input: {
        readonly tx: DrizzleClient;
        readonly ownerId: string;
        readonly vertical: string;
    },
    ports: PurchaseAddonPorts
): Promise<boolean> {
    const principals = await input.tx
        .select({ id: subscriptions.id, predecessorId: subscriptions.succeedsId })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, input.ownerId),
                eq(subscriptions.vertical, input.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'ACTIVE')
            )
        );
    const payments = ports.payments ?? creditedPaymentsFromLedger;
    for (const principal of principals) {
        if (await payments.hasCreditedPayment({ subscriptionId: principal.id, tx: input.tx }))
            return true;
        if (
            principal.predecessorId &&
            (await payments.hasCreditedPayment({
                subscriptionId: principal.predecessorId,
                tx: input.tx
            }))
        )
            return true;
    }
    return (ports.liveAnchors ?? permanentGrantLiveAnchors).hasLiveAnchor({
        userId: input.ownerId,
        vertical: input.vertical,
        tx: input.tx
    });
}

/** Resolves the purchase target and a paying principal or live grant anchor. */
export async function resolvePurchaseTitle(
    input: {
        readonly tx: DrizzleClient;
        readonly ownerId: string;
        readonly product: SelectAddonProduct;
        readonly scopeType: AddonScopeType;
        readonly targetId: string | null;
    },
    ports: PurchaseAddonPorts
): Promise<PurchaseTitleResult> {
    const { tx, ownerId, product, scopeType, targetId } = input;
    let vertical: string | undefined;
    if (scopeType === 'LISTING') {
        if (!targetId) return { reason: 'TARGET_NOT_FOUND' };
        try {
            const listing = await ports.listing({ listingId: targetId });
            if (
                listing.ownerId !== ownerId ||
                !product.compatibleVerticals.includes(listing.vertical) ||
                !listing.acceptsFeature
            )
                return { reason: 'TARGET_NOT_FOUND' };
            vertical = listing.vertical;
        } catch (error) {
            if (error instanceof Error && error.name === 'ListingNotFoundError')
                return { reason: 'TARGET_NOT_FOUND' };
            throw error;
        }
    } else if (scopeType === 'VERTICAL_SUBSCRIPTION') {
        if (!targetId) return { reason: 'TARGET_NOT_FOUND' };
        const [target] = await tx
            .select({ vertical: subscriptions.vertical })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.id, targetId),
                    eq(subscriptions.userId, ownerId),
                    eq(subscriptions.class, 'PRINCIPAL')
                )
            )
            .limit(1);
        if (!target?.vertical || !product.compatibleVerticals.includes(target.vertical))
            return { reason: 'TARGET_NOT_FOUND' };
        vertical = target.vertical;
    } else {
        if (targetId !== null) return { reason: 'TARGET_NOT_FOUND' };
        for (const candidate of product.compatibleVerticals) {
            if (await hasTitle({ tx, ownerId, vertical: candidate }, ports))
                return { vertical: candidate };
        }
        return { reason: 'NO_VALID_TITLE' };
    }
    if (await hasTitle({ tx, ownerId, vertical }, ports)) return { vertical };
    return { reason: 'NO_VALID_TITLE' };
}
