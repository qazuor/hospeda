import { addonProducts, addons, getDb, planCatalogModel } from '@repo/db';
import type { AddonOffersResponse } from '@repo/schemas';
import { AddonOffersResponseSchema } from '@repo/schemas';
import { findIncludesAddonsAnchor } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

/** Reads saleable products, their verticals policy and the owner's free grant options in one snapshot. */
export async function readAddonOffers(input: {
    readonly ownerId: string;
}): Promise<AddonOffersResponse> {
    const { ownerId } = z.strictObject({ ownerId: z.uuid() }).parse(input);
    return getDb().transaction(async (tx) => {
        const rows = await tx
            .select({
                productId: addonProducts.id,
                addonVersionId: addonProducts.versionId,
                addonId: addonProducts.addonId,
                name: addons.name,
                description: addons.description,
                chargeKind: addonProducts.chargeKind,
                cycle: addonProducts.cycle,
                price: addonProducts.price,
                currency: addonProducts.currency,
                compatibleVerticals: addonProducts.compatibleVerticals
            })
            .from(addonProducts)
            .innerJoin(addons, eq(addons.id, addonProducts.addonId))
            .where(isNull(addonProducts.retiredAt))
            .orderBy(asc(addons.name), asc(addonProducts.id));
        const reader = new Proxy(planCatalogModel, {
            get(target, property, receiver) {
                if (property === 'findAddonVersion')
                    return ({ id }: { readonly id: string }) => target.findAddonVersion({ id, tx });
                return Reflect.get(target, property, receiver);
            }
        });
        const addonPolicy = createPlanCatalogInverse({ reader }).addonPolicy;
        const verticals = [...new Set(rows.flatMap((row) => row.compatibleVerticals))];
        const freeVerticals = new Set<string>();
        for (const vertical of verticals) {
            const anchor = await findIncludesAddonsAnchor({ tx, userId: ownerId, vertical });
            if (anchor) freeVerticals.add(vertical);
        }
        const items = [];
        for (const row of rows) {
            const policy = await addonPolicy({ addonVersionId: row.addonVersionId });
            if (policy.addonId !== row.addonId)
                throw new Error('Addon product and policy addon disagree');
            items.push({
                productId: row.productId,
                addonVersionId: row.addonVersionId,
                name: row.name,
                description: row.description,
                chargeKind: row.chargeKind,
                cycle: row.cycle,
                price: row.price,
                currency: row.currency,
                compatibleVerticals: row.compatibleVerticals,
                scopeType: policy.scopeType,
                validity: policy.validity,
                validityDays: policy.validityDays,
                freeUnderGrantVerticals: row.compatibleVerticals.filter((vertical) =>
                    freeVerticals.has(vertical)
                )
            });
        }
        return AddonOffersResponseSchema.parse({ items });
    });
}
