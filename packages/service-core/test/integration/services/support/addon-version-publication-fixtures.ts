import {
    addonInstances,
    addonProducts,
    addonVersions,
    eq,
    inArray,
    planCatalogModel
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getServiceTestDb } from '../helpers';
import { purchaseFixture, retirePurchaseFixtures } from './addon-purchase-fixtures';

const productIds: string[] = [];

/** Seed a second immutable addon version through INSERT for TEST:B10:9 (D-3). */
export async function publicationFixture(
    input: { readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO' } = {}
) {
    const purchase = await purchaseFixture({ chargeKind: input.chargeKind ?? 'UNA_VEZ' });
    productIds.push(purchase.productId);
    const db = getServiceTestDb();
    const [product] = await db
        .select()
        .from(addonProducts)
        .where(eq(addonProducts.id, purchase.productId));
    if (!product) throw new Error('Publication fixture product missing');
    const [version] = await db
        .insert(addonVersions)
        .values({
            addonId: product.addonId,
            validity: input.chargeKind === 'PERIODICO' ? 'WHILE_SUBSCRIPTION_ALIVE' : 'FIXED_DAYS',
            validityDays: input.chargeKind === 'PERIODICO' ? null : 30,
            scopeType: 'USER'
        })
        .returning();
    if (!version) throw new Error('Publication fixture version missing');
    return {
        ...purchase,
        purchasePorts: purchase.ports,
        product,
        nextVersionId: version.id,
        actor: {
            id: purchase.ownerId,
            roles: [],
            permissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
        },
        ports: { addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy }
    };
}

/** Retire this test's live rows and remove its own product/instance rows by id. */
export async function retirePublicationFixtures(): Promise<void> {
    const ids = productIds.splice(0);
    await retirePurchaseFixtures();
    if (ids.length === 0) return;
    const db = getServiceTestDb();
    await db.delete(addonInstances).where(inArray(addonInstances.productId, ids));
    await db.delete(addonProducts).where(inArray(addonProducts.id, ids));
}
