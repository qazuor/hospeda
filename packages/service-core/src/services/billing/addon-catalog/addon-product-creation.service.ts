import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { SelectAddonProduct } from '@repo/db';
import { addonProducts, addons, eq, getDb, sql } from '@repo/db';
import { CreateAddonProductRequestSchema, ServiceErrorCode } from '@repo/schemas';
import { CatalogVersionNotFoundError } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import {
    PROVIDER_AMOUNT_CEILING_MINOR,
    PROVIDER_AMOUNT_FLOOR_MINOR
} from '../promo/provider-amount-floor.js';
import {
    addonVersionPublicationRejection,
    assertAddonVersionPublicationPermitted,
    mapAddonVersionPublicationWriteError
} from './addon-version-publication-authorization.js';

/** Only the inverse version policy is needed by product creation. */
export type AddonProductCreationPorts = Pick<VerticalsForBilling, 'addonPolicy'>;

function reject(reason: Parameters<typeof addonVersionPublicationRejection>[0]['reason']): never {
    throw addonVersionPublicationRejection({ reason, message: reason });
}

/** Create the one product for an addon; compatible verticals are fixed at creation. */
export async function createAddonProduct(
    args: { readonly actor?: Actor; readonly input: unknown },
    ports: AddonProductCreationPorts
): Promise<SelectAddonProduct> {
    assertAddonVersionPublicationPermitted({ actor: args.actor });
    const parsed = CreateAddonProductRequestSchema.safeParse(args.input);
    if (!parsed.success) reject('INVALID_ADDON_VERSION_PUBLICATION_INPUT');
    const input = parsed.data;
    const [addon] = await getDb()
        .select({ id: addons.id })
        .from(addons)
        .where(eq(addons.id, input.addonId))
        .limit(1);
    if (!addon) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'ADDON_NOT_FOUND',
            undefined,
            'ADDON_NOT_FOUND'
        );
    }
    let policy: Awaited<ReturnType<AddonProductCreationPorts['addonPolicy']>>;
    try {
        policy = await ports.addonPolicy({ addonVersionId: input.versionId });
    } catch (error) {
        if (error instanceof CatalogVersionNotFoundError && error.kind === 'addon_version') {
            reject('ADDON_VERSION_NOT_FOUND');
        }
        throw error;
    }
    if (policy.addonId !== input.addonId) reject('ADDON_VERSION_OF_ANOTHER_ADDON');
    if (input.chargeKind === 'PERIODICO' && policy.validity === 'FIXED_DAYS') {
        reject('ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND');
    }
    if (input.price < PROVIDER_AMOUNT_FLOOR_MINOR) reject('ADDON_PRICE_BELOW_PROVIDER_MINIMUM');
    if (input.price > PROVIDER_AMOUNT_CEILING_MINOR) reject('ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM');
    try {
        return await getDb().transaction(async (tx) => {
            // Serialize creation for one addon without changing its vertical catalog row.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.addonId}))`);
            const [existing] = await tx
                .select({ id: addonProducts.id })
                .from(addonProducts)
                .where(eq(addonProducts.addonId, input.addonId))
                .limit(1);
            if (existing) {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'ADDON_PRODUCT_ALREADY_EXISTS',
                    undefined,
                    'ADDON_PRODUCT_ALREADY_EXISTS'
                );
            }
            const [product] = await tx
                .insert(addonProducts)
                .values({
                    addonId: input.addonId,
                    versionId: input.versionId,
                    price: input.price,
                    currency: 'ARS',
                    chargeKind: input.chargeKind,
                    cycle: input.cycle,
                    compatibleVerticals: input.compatibleVerticals
                })
                .returning();
            if (!product) reject('ADDON_PRODUCT_NOT_FOUND');
            return product;
        });
    } catch (error) {
        mapAddonVersionPublicationWriteError({ error });
    }
}
