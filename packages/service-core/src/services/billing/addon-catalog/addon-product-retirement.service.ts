import { addonProducts, eq, getDb } from '@repo/db';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import {
    addonVersionPublicationRejection,
    assertAddonVersionPublicationPermitted
} from './addon-version-publication-authorization.js';

const inputSchema = z.strictObject({ productId: z.uuid() });

/** Saleability state for an action 20 addon product. */
export type AddonProductRetirement = {
    readonly productId: string;
    readonly retiredAt: Date | null;
};

async function changeRetirement(input: {
    readonly actor?: Actor;
    readonly productId: string;
    readonly retire: boolean;
}): Promise<AddonProductRetirement> {
    assertAddonVersionPublicationPermitted({ actor: input.actor });
    const { productId } = inputSchema.parse({ productId: input.productId });
    return getDb().transaction(async (tx) => {
        const [product] = await tx
            .select({ id: addonProducts.id, retiredAt: addonProducts.retiredAt })
            .from(addonProducts)
            .where(eq(addonProducts.id, productId))
            .for('update')
            .limit(1);
        if (!product)
            throw addonVersionPublicationRejection({
                reason: 'ADDON_PRODUCT_NOT_FOUND',
                message: 'Addon product not found'
            });
        if (input.retire === (product.retiredAt !== null))
            return { productId, retiredAt: product.retiredAt };
        const [updated] = await tx
            .update(addonProducts)
            .set({ retiredAt: input.retire ? new Date() : null })
            .where(eq(addonProducts.id, productId))
            .returning({ retiredAt: addonProducts.retiredAt });
        if (!updated) throw new Error('Locked addon product disappeared');
        return { productId, retiredAt: updated.retiredAt };
    });
}

/** Stop selling a product without changing existing addon instances. */
export async function retireAddonProduct(input: {
    readonly actor?: Actor;
    readonly productId: string;
}): Promise<AddonProductRetirement> {
    return changeRetirement({ ...input, retire: true });
}

/** Restore saleability without changing existing addon instances. */
export async function unretireAddonProduct(input: {
    readonly actor?: Actor;
    readonly productId: string;
}): Promise<AddonProductRetirement> {
    return changeRetirement({ ...input, retire: false });
}

/** Read the persisted saleability state for the action 20 editor. */
export async function readAddonProductRetirement(input: {
    readonly actor?: Actor;
    readonly productId: string;
}): Promise<AddonProductRetirement> {
    assertAddonVersionPublicationPermitted({ actor: input.actor });
    const { productId } = inputSchema.parse({ productId: input.productId });
    const [product] = await getDb()
        .select({ id: addonProducts.id, retiredAt: addonProducts.retiredAt })
        .from(addonProducts)
        .where(eq(addonProducts.id, productId))
        .limit(1);
    if (!product)
        throw addonVersionPublicationRejection({
            reason: 'ADDON_PRODUCT_NOT_FOUND',
            message: 'Addon product not found'
        });
    return { productId: product.id, retiredAt: product.retiredAt };
}
