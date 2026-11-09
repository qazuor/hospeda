import {
    addonInstances,
    addonProducts,
    addons,
    addonVersionEntitlements,
    addonVersionLimits,
    addonVersions,
    getDb,
    inArray
} from '@repo/db';
import type { AdminAddonCatalogResponse } from '@repo/schemas';
import { AdminAddonCatalogResponseSchema } from '@repo/schemas';

/** Read identity, immutable grants, current product and live purchases for action 20. */
export async function readAdminAddonCatalog(): Promise<AdminAddonCatalogResponse> {
    const db = getDb();
    const [addonRows, versionRows, entitlementRows, limitRows, productRows, instanceRows] =
        await Promise.all([
            db.select().from(addons),
            db.select().from(addonVersions),
            db.select().from(addonVersionEntitlements),
            db.select().from(addonVersionLimits),
            db.select().from(addonProducts),
            db
                .select({
                    versionId: addonInstances.addonVersionId,
                    productId: addonInstances.productId
                })
                .from(addonInstances)
                .where(inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE']))
        ]);
    const liveByVersion = new Map<string, number>();
    for (const instance of instanceRows) {
        const key = `${instance.productId}:${instance.versionId}`;
        liveByVersion.set(key, (liveByVersion.get(key) ?? 0) + 1);
    }
    const items = addonRows
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((addon) => {
            const product = productRows.find((row) => row.addonId === addon.id);
            const versions = versionRows
                .filter((row) => row.addonId === addon.id)
                .sort(
                    (a, b) =>
                        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
                )
                .map((version) => ({
                    id: version.id,
                    addonId: version.addonId,
                    validity: version.validity,
                    validityDays: version.validityDays,
                    scopeType: version.scopeType,
                    entitlements: entitlementRows
                        .filter((row) => row.addonVersionId === version.id)
                        .map((row) => row.key)
                        .sort(),
                    limits: limitRows
                        .filter((row) => row.addonVersionId === version.id)
                        .map((row) => ({ key: row.key, value: row.value }))
                        .sort((a, b) => a.key.localeCompare(b.key)),
                    liveInstances: product
                        ? (liveByVersion.get(`${product.id}:${version.id}`) ?? 0)
                        : 0
                }));
            return {
                id: addon.id,
                slug: addon.slug,
                name: addon.name,
                description: addon.description,
                versions,
                product: product
                    ? {
                          id: product.id,
                          versionId: product.versionId,
                          price: product.price,
                          currency: product.currency,
                          chargeKind: product.chargeKind,
                          cycle: product.cycle,
                          compatibleVerticals: product.compatibleVerticals
                      }
                    : null
            };
        });
    return AdminAddonCatalogResponseSchema.parse({ items });
}
