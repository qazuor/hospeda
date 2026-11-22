import type { AddonPolicyResponse } from '@repo/billing-verticals-contract';
import { ADDON_CYCLES, type SelectAddonProduct } from '@repo/db';
import { VerticalEnumSchema } from '@repo/schemas';
import type { AddonFact, AddonFactCycle } from '../facts/addon-fact';

/** The `ADDON_CHECKOUT_STARTED` fact. */
export type AddonCheckoutStartedFact = Extract<
    AddonFact,
    { readonly kind: 'ADDON_CHECKOUT_STARTED' }
>;

/**
 * Builds `addon_checkout_started` from the rows A1 held when it created the purchase (HOS-1883
 * §5.2): the product row (price, cycle) and the anchored policy (addon id, scope). The vertical
 * follows P-4': the title vertical for a recurring add-on (its COMPLEMENTO's) or a targeted one,
 * the product's single compatible vertical for a one-time `USER`/`GLOBAL` add-on.
 *
 * @param input.product - The product row the purchase anchored
 * @param input.policy - The anchored version's policy
 * @param input.instanceId - The created instance
 * @param input.ownerId - The buyer (`distinct_id`)
 * @param input.titleVertical - The vertical A1 resolved the title in
 * @param input.complementId - The pending COMPLEMENTO of a recurring add-on
 * @param input.now - The instant of the purchase
 * @returns The fact, or `undefined` for a product outside the catalog's invariants
 */
export function checkoutStartedFact(input: {
    readonly product: SelectAddonProduct;
    readonly policy: Pick<AddonPolicyResponse, 'addonId' | 'scopeType'>;
    readonly instanceId: string;
    readonly ownerId: string;
    readonly titleVertical: string;
    readonly complementId?: string;
    readonly now: Date;
}): AddonCheckoutStartedFact | undefined {
    const { product, policy } = input;
    if (product.currency !== 'ARS') return undefined;
    if (product.chargeKind !== 'UNA_VEZ' && product.chargeKind !== 'PERIODICO') return undefined;
    const untargeted = policy.scopeType === 'USER' || policy.scopeType === 'GLOBAL';
    const rawVertical =
        product.chargeKind === 'PERIODICO' || !untargeted
            ? input.titleVertical
            : product.compatibleVerticals.length === 1
              ? product.compatibleVerticals[0]
              : undefined;
    const vertical = rawVertical ? VerticalEnumSchema.safeParse(rawVertical) : undefined;
    const cycle =
        product.cycle && (ADDON_CYCLES as readonly string[]).includes(product.cycle)
            ? (product.cycle as AddonFactCycle)
            : undefined;
    return {
        kind: 'ADDON_CHECKOUT_STARTED',
        userId: input.ownerId,
        addonInstanceId: input.instanceId,
        addonId: policy.addonId,
        addonVersionId: product.versionId,
        addonProductId: product.id,
        chargeKind: product.chargeKind,
        scopeType: policy.scopeType,
        ...(vertical?.success ? { vertical: vertical.data } : {}),
        ...(input.complementId ? { subscriptionId: input.complementId } : {}),
        actorKind: 'USER',
        occurredAt: input.now,
        amountMinor: product.price,
        currency: 'ARS',
        ...(cycle ? { cycle } : {})
    };
}
