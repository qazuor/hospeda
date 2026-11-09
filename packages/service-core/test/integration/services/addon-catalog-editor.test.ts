import {
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    catalogKeys,
    eq,
    inArray,
    planCatalogModel
} from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { createAddonProduct } from '../../../src/services/billing/addon-catalog/addon-product-creation.service';
import { publishAddonVersion } from '../../../src/services/billing/addon-catalog/addon-version-publication.service';
import { readAdminAddonCatalog } from '../../../src/services/billing/addon-catalog/admin-addon-catalog.read';
import {
    createAddon,
    createAddonVersion
} from '../../../src/services/plan-catalog/addon-version-creation.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

const actor = {
    id: crypto.randomUUID(),
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
};
const admin = { id: crypto.randomUUID(), roles: [RoleEnum.ADMIN], permissions: [] };
const policy = { addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy };
const productIds: string[] = [];

async function cleanup(): Promise<void> {
    await retirePurchaseFixtures();
    const ids = productIds.splice(0);
    if (ids.length === 0) return;
    const db = getServiceTestDb();
    await db.delete(addonInstances).where(inArray(addonInstances.productId, ids));
    await db.delete(addonProducts).where(inArray(addonProducts.id, ids));
}

afterEach(cleanup);
afterAll(closeServiceTestPool);

async function keys() {
    const rows = await getServiceTestDb().select().from(catalogKeys);
    const entitlement = rows.find((row) => row.kind === 'entitlement');
    const limit = rows.find((row) => row.kind === 'limit');
    if (!entitlement || !limit) throw new Error('Catalog keys missing');
    return { entitlement: entitlement.key, limit: limit.key };
}

function firstVersion(entitlement: string, limit: string) {
    return {
        validity: 'WHILE_SUBSCRIPTION_ALIVE' as const,
        validityDays: null,
        scopeType: 'USER' as const,
        entitlements: [entitlement],
        limits: [{ key: limit, value: 3 }]
    };
}

async function createdCatalog() {
    const { entitlement, limit } = await keys();
    const slug = `b13b-editor-${crypto.randomUUID()}`;
    const created = await createAddon({
        actor,
        input: {
            slug,
            name: 'Editor feature',
            description: 'Action 20',
            firstVersion: firstVersion(entitlement, limit)
        }
    });
    const product = await createAddonProduct(
        {
            actor,
            input: {
                addonId: created.addon.id,
                versionId: created.version.id,
                price: 5000,
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                compatibleVerticals: ['accommodation']
            }
        },
        policy
    );
    productIds.push(product.id);
    return { ...created, product, slug, entitlement, limit };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B13b:3 AC:B13b:3 the action 20 editor creates an addon, a version and its product',
    () => {
        it('SUPER_ADMIN creates an addon and first version, product, and reads the complete catalog', async () => {
            const created = await createdCatalog();
            const item = (await readAdminAddonCatalog()).items.find(
                ({ id }) => id === created.addon.id
            );
            expect(item).toEqual({
                id: created.addon.id,
                slug: created.slug,
                name: 'Editor feature',
                description: 'Action 20',
                versions: [
                    {
                        id: created.version.id,
                        addonId: created.addon.id,
                        validity: 'WHILE_SUBSCRIPTION_ALIVE',
                        validityDays: null,
                        scopeType: 'USER',
                        entitlements: [created.entitlement],
                        limits: [{ key: created.limit, value: 3 }],
                        liveInstances: 0
                    }
                ],
                product: {
                    id: created.product.id,
                    versionId: created.version.id,
                    price: 5000,
                    currency: 'ARS',
                    chargeKind: 'PERIODICO',
                    cycle: 'monthly',
                    compatibleVerticals: ['accommodation']
                }
            });
        });

        it('a real purchase stays anchored to its version after creation and publication repoints only the product', async () => {
            const created = await createdCatalog();
            const f = await purchaseFixture({ chargeKind: 'PERIODICO' });
            await payingPrincipal(f);
            const bought = await purchaseAddon(
                {
                    ...f.input(),
                    productId: created.product.id,
                    expectedAddonVersionId: created.version.id
                },
                f.ports
            );
            expect(bought.outcome).toBe('CREATED');
            if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
            const next = await createAddonVersion({
                actor,
                input: {
                    addonId: created.addon.id,
                    ...firstVersion(created.entitlement, created.limit),
                    limits: [{ key: created.limit, value: 5 }]
                }
            });
            const db = getServiceTestDb();
            const [before] = await db
                .select({ addonVersionId: addonInstances.addonVersionId })
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            expect(before).toEqual({ addonVersionId: created.version.id });
            const beforeRead = (await readAdminAddonCatalog()).items.find(
                ({ id }) => id === created.addon.id
            );
            expect(
                beforeRead?.versions.map(({ id, liveInstances }) => ({ id, liveInstances }))
            ).toEqual([
                { id: created.version.id, liveInstances: 1 },
                { id: next.id, liveInstances: 0 }
            ]);
            const published = await publishAddonVersion(
                {
                    actor,
                    input: {
                        productId: created.product.id,
                        addonVersionId: next.id,
                        price: created.product.price,
                        expectedCurrentVersionId: created.version.id,
                        expectedCurrentPrice: created.product.price
                    }
                },
                { addonPolicy: f.ports.addonPolicy }
            );
            expect(published.product.versionId).toBe(next.id);
            const [after] = await db
                .select({ addonVersionId: addonInstances.addonVersionId })
                .from(addonInstances)
                .where(eq(addonInstances.id, bought.instanceId));
            expect(after).toEqual({ addonVersionId: created.version.id });
            const afterRead = (await readAdminAddonCatalog()).items.find(
                ({ id }) => id === created.addon.id
            );
            expect(afterRead?.product?.versionId).toBe(next.id);
            expect(
                afterRead?.versions.map(({ id, liveInstances }) => ({ id, liveInstances }))
            ).toEqual([
                { id: created.version.id, liveInstances: 1 },
                { id: next.id, liveInstances: 0 }
            ]);
        });

        it('ADMIN without the action 20 permission is rejected by all three creations with zero rows', async () => {
            const { entitlement, limit } = await keys();
            const slug = `b13b-denied-${crypto.randomUUID()}`;
            const allowed = await createAddon({
                actor,
                input: {
                    slug: `b13b-authorized-${crypto.randomUUID()}`,
                    name: 'Authorized catalog',
                    description: null,
                    firstVersion: firstVersion(entitlement, limit)
                }
            });
            const addonId = allowed.addon.id;
            const versionId = allowed.version.id;
            await expect(
                createAddon({
                    actor: admin,
                    input: {
                        slug,
                        name: 'Denied',
                        description: null,
                        firstVersion: firstVersion(entitlement, limit)
                    }
                })
            ).rejects.toMatchObject({
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
                code: ServiceErrorCode.FORBIDDEN
            });
            await expect(
                createAddonVersion({
                    actor: admin,
                    input: {
                        addonId,
                        ...firstVersion(entitlement, limit)
                    }
                })
            ).rejects.toMatchObject({
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
                code: ServiceErrorCode.FORBIDDEN
            });
            await expect(
                createAddonProduct(
                    {
                        actor: admin,
                        input: {
                            addonId,
                            versionId,
                            price: 5000,
                            chargeKind: 'PERIODICO',
                            cycle: 'monthly',
                            compatibleVerticals: ['accommodation']
                        }
                    },
                    policy
                )
            ).rejects.toMatchObject({
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
                code: ServiceErrorCode.FORBIDDEN
            });
            const db = getServiceTestDb();
            expect(await db.select().from(addons).where(eq(addons.slug, slug))).toHaveLength(0);
            expect(
                await db
                    .select({ id: addonVersions.id })
                    .from(addonVersions)
                    .where(eq(addonVersions.addonId, addonId))
            ).toEqual([{ id: versionId }]);
            expect(
                await db.select().from(addonProducts).where(eq(addonProducts.addonId, addonId))
            ).toHaveLength(0);
        });

        it('rejects a missing catalog key by name, PERIODICO with FIXED_DAYS and a duplicate product', async () => {
            const { entitlement, limit } = await keys();
            const missing = `missing-${crypto.randomUUID()}`;
            const slug = `b13b-bad-${crypto.randomUUID()}`;
            await expect(
                createAddon({
                    actor,
                    input: {
                        slug,
                        name: 'Invalid',
                        description: null,
                        firstVersion: {
                            ...firstVersion(entitlement, limit),
                            entitlements: [missing]
                        }
                    }
                })
            ).rejects.toMatchObject({
                reason: 'ADDON_CATALOG_KEY_INVALID',
                message: `Invalid catalog key: ${missing}`
            });
            expect(
                await getServiceTestDb().select().from(addons).where(eq(addons.slug, slug))
            ).toHaveLength(0);
            const created = await createdCatalog();
            const fixed = await createAddonVersion({
                actor,
                input: {
                    addonId: created.addon.id,
                    validity: 'FIXED_DAYS',
                    validityDays: 30,
                    scopeType: 'USER',
                    entitlements: [entitlement],
                    limits: []
                }
            });
            await expect(
                createAddonProduct(
                    {
                        actor,
                        input: {
                            addonId: created.addon.id,
                            versionId: fixed.id,
                            price: 5000,
                            chargeKind: 'PERIODICO',
                            cycle: 'monthly',
                            compatibleVerticals: ['accommodation']
                        }
                    },
                    policy
                )
            ).rejects.toMatchObject({
                reason: 'ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND'
            });
            await expect(
                createAddonProduct(
                    {
                        actor,
                        input: {
                            addonId: created.addon.id,
                            versionId: created.version.id,
                            price: 5000,
                            chargeKind: 'PERIODICO',
                            cycle: 'monthly',
                            compatibleVerticals: ['accommodation']
                        }
                    },
                    policy
                )
            ).rejects.toMatchObject({
                reason: 'ADDON_PRODUCT_ALREADY_EXISTS',
                code: ServiceErrorCode.ALREADY_EXISTS
            });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(addonProducts)
                    .where(eq(addonProducts.addonId, created.addon.id))
            ).toHaveLength(1);
        });

        it('returns 404 for a missing addon before checking whether the version belongs to it', async () => {
            const owner = await createdCatalog();
            const input = {
                addonId: crypto.randomUUID(),
                versionId: owner.version.id,
                price: 5000,
                chargeKind: 'UNA_VEZ' as const,
                cycle: null,
                compatibleVerticals: ['accommodation'] as const
            };
            await expect(createAddonProduct({ actor, input }, policy)).rejects.toMatchObject({
                reason: 'ADDON_NOT_FOUND',
                code: ServiceErrorCode.NOT_FOUND
            });

            const target = await createAddon({
                actor,
                input: {
                    slug: `b13b-other-${crypto.randomUUID()}`,
                    name: 'Other addon',
                    description: null,
                    firstVersion: firstVersion(owner.entitlement, owner.limit)
                }
            });
            await expect(
                createAddonProduct({ actor, input: { ...input, addonId: target.addon.id } }, policy)
            ).rejects.toMatchObject({
                reason: 'ADDON_VERSION_OF_ANOTHER_ADDON',
                code: ServiceErrorCode.VALIDATION_ERROR
            });
        });
    }
);
