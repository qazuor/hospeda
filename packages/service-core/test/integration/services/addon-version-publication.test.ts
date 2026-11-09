import { addonInstances, addonProducts, addonVersions, domainEventModel, eq } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import {
    previewAddonVersionPublication,
    publishAddonVersion
} from '../../../src/services/billing/addon-catalog/addon-version-publication.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { principalFixture } from './support/addon-purchase-fixtures';
import {
    publicationFixture,
    retirePublicationFixtures
} from './support/addon-version-publication-fixtures';

const skip = !isServiceTestDbAvailable();
afterEach(retirePublicationFixtures);
afterAll(closeServiceTestPool);

function request(f: Awaited<ReturnType<typeof publicationFixture>>, price = f.product.price) {
    return {
        productId: f.productId,
        addonVersionId: f.nextVersionId,
        price,
        expectedCurrentVersionId: f.versionId,
        expectedCurrentPrice: f.product.price
    };
}

function previewRequest(
    f: Awaited<ReturnType<typeof publicationFixture>>,
    price = f.product.price
) {
    return { productId: f.productId, addonVersionId: f.nextVersionId, price };
}

describe('TEST:B10:9 AC:B10:8 addon version publication', () => {
    it.skipIf(skip)('rejects provider floor and ceiling before writing', async () => {
        const f = await publicationFixture();
        await expect(
            publishAddonVersion({ actor: f.actor, input: request(f, 1499) }, f.ports)
        ).rejects.toMatchObject({ reason: 'ADDON_PRICE_BELOW_PROVIDER_MINIMUM' });
        await expect(
            publishAddonVersion({ actor: f.actor, input: request(f, 200000001) }, f.ports)
        ).rejects.toMatchObject({ reason: 'ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM' });
        const [product] = await getServiceTestDb()
            .select()
            .from(addonProducts)
            .where(eq(addonProducts.id, f.productId));
        expect(product?.versionId).toBe(f.versionId);
    });

    it.skipIf(skip)('rejects a missing version through the real addonPolicy port', async () => {
        const f = await publicationFixture();
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: { ...request(f), addonVersionId: crypto.randomUUID() } },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'ADDON_VERSION_NOT_FOUND' });
    });

    it.skipIf(skip)('rejects a publication with no version or price change', async () => {
        const f = await publicationFixture();
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: { ...request(f), addonVersionId: f.versionId } },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'ADDON_PRODUCT_UNCHANGED' });
    });

    it.skipIf(skip)('previews version and price changes against the current version', async () => {
        const f = await publicationFixture();
        const preview = await previewAddonVersionPublication(
            {
                actor: f.actor,
                input: {
                    productId: f.productId,
                    addonVersionId: f.nextVersionId,
                    price: f.product.price + 100
                }
            },
            f.ports
        );
        expect(preview).toMatchObject({
            current: { versionId: f.versionId, price: f.product.price },
            proposed: { versionId: f.nextVersionId, price: f.product.price + 100 },
            changes: ['VERSION', 'PRICE'],
            liveInstancesOnCurrentVersion: 0,
            alreadyPurchasedStaysAnchored: true
        });
        expect(preview.current.policy.addonId).toBe(f.product.addonId);
        expect(preview.proposed.policy.addonId).toBe(f.product.addonId);
    });

    it.skipIf(skip)(
        'previews a price change only while the product has no live instances',
        async () => {
            const f = await publicationFixture();
            const changedPrice = f.product.price + 100;
            await expect(
                previewAddonVersionPublication(
                    { actor: f.actor, input: previewRequest(f, changedPrice) },
                    f.ports
                )
            ).resolves.toMatchObject({ changes: ['VERSION', 'PRICE'] });

            await principalFixture({ ownerId: f.ownerId, credited: true });
            expect((await purchaseAddon(f.input(), f.purchasePorts)).outcome).toBe('CREATED');
            await expect(
                previewAddonVersionPublication(
                    { actor: f.actor, input: previewRequest(f, changedPrice) },
                    f.ports
                )
            ).rejects.toMatchObject({
                reason: 'ADDON_PRODUCT_HAS_LIVE_INSTANCES',
                code: ServiceErrorCode.ALREADY_EXISTS
            });
            await expect(
                previewAddonVersionPublication(
                    { actor: f.actor, input: previewRequest(f) },
                    f.ports
                )
            ).resolves.toMatchObject({
                changes: ['VERSION'],
                liveInstancesOnCurrentVersion: 1
            });
        }
    );

    it.skipIf(skip)(
        'publishes the same addon version while a real purchase stays anchored',
        async () => {
            const f = await publicationFixture();
            await principalFixture({ ownerId: f.ownerId, credited: true });
            const purchase = await purchaseAddon(f.input(), f.purchasePorts);
            expect(purchase.outcome).toBe('CREATED');
            const [before] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.ownerId, f.ownerId));
            expect(before?.addonVersionId).toBe(f.versionId);
            const result = await publishAddonVersion(
                { actor: f.actor, input: request(f), correlationId: crypto.randomUUID() },
                f.ports
            );
            expect(result.product).toMatchObject({
                versionId: f.nextVersionId,
                price: f.product.price,
                updatedAt: expect.any(Date)
            });
            const [after] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, before!.id));
            expect(after?.addonVersionId).toBe(f.versionId);
            const events = await domainEventModel.findByEntity({
                entityType: 'addon_product',
                entityId: f.productId
            });
            expect(
                events.find(
                    (row) =>
                        row.eventType === 'addon_product.version_published' &&
                        row.entityId === f.productId
                )
            ).toMatchObject({
                id: result.domainEventId,
                actorType: 'admin',
                actorId: f.actor.id,
                changes: [
                    { field: 'version_id', old: f.versionId, new: f.nextVersionId },
                    { field: 'price', old: f.product.price, new: f.product.price }
                ]
            });
        }
    );

    it.skipIf(skip)(
        'rejects a version of another addon and keeps the current pointer',
        async () => {
            const f = await publicationFixture();
            const other = await publicationFixture();
            await expect(
                publishAddonVersion(
                    {
                        actor: f.actor,
                        input: { ...request(f), addonVersionId: other.nextVersionId }
                    },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'ADDON_VERSION_OF_ANOTHER_ADDON' });
            const [product] = await getServiceTestDb()
                .select()
                .from(addonProducts)
                .where(eq(addonProducts.id, f.productId));
            expect(product?.versionId).toBe(f.versionId);
        }
    );

    it.skipIf(skip)('rejects fields that would edit addon_version', async () => {
        const f = await publicationFixture();
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: { ...request(f), validity: 'FIXED_DAYS' } },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'INVALID_ADDON_VERSION_PUBLICATION_INPUT' });
        await expect(
            getServiceTestDb().transaction(async (tx) => {
                await tx
                    .update(addonVersions)
                    .set({ validityDays: 50 })
                    .where(eq(addonVersions.id, f.nextVersionId));
            })
        ).rejects.toBeDefined();
    });

    it.skipIf(skip)('rejects a stale confirmation', async () => {
        const f = await publicationFixture();
        await publishAddonVersion({ actor: f.actor, input: request(f) }, f.ports);
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: { ...request(f), price: f.product.price + 100 } },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'ADDON_PRODUCT_CHANGED_SINCE_PREVIEW' });
    });

    it.skipIf(skip)(
        'rolls back the product update when the domain event insert fails',
        async () => {
            const f = await publicationFixture();
            await expect(
                publishAddonVersion(
                    { actor: f.actor, input: request(f), correlationId: 'invalid-correlation-id' },
                    f.ports
                )
            ).rejects.toBeDefined();
            const [product] = await getServiceTestDb()
                .select()
                .from(addonProducts)
                .where(eq(addonProducts.id, f.productId));
            expect(product?.versionId).toBe(f.versionId);
            expect(product?.price).toBe(f.product.price);
        }
    );

    it.skipIf(skip)('writes the event through the transaction client', async () => {
        const f = await publicationFixture();
        const insert = domainEventModel.insert.bind(domainEventModel);
        const spy = vi.spyOn(domainEventModel, 'insert').mockImplementation(async (input) => {
            expect(input.tx).toBeDefined();
            return insert(input);
        });
        try {
            await publishAddonVersion({ actor: f.actor, input: request(f) }, f.ports);
            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            spy.mockRestore();
        }
    });

    it.skipIf(skip)('rejects a price change with a pending real purchase', async () => {
        const f = await publicationFixture();
        await principalFixture({ ownerId: f.ownerId, credited: true });
        expect((await purchaseAddon(f.input(), f.purchasePorts)).outcome).toBe('CREATED');
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: request(f, f.product.price + 100) },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'ADDON_PRODUCT_HAS_LIVE_INSTANCES' });
    });

    it.skipIf(skip)('rejects a fixed-days version for a periodic product', async () => {
        const f = await publicationFixture({ chargeKind: 'PERIODICO' });
        // Vertical creation is outside this sheet; this immutable version is seeded by INSERT.
        const [fixed] = await getServiceTestDb()
            .insert(addonVersions)
            .values({
                addonId: f.product.addonId,
                validity: 'FIXED_DAYS',
                validityDays: 30,
                scopeType: 'USER'
            })
            .returning();
        if (!fixed) throw new Error('Fixed-days version fixture missing');
        await expect(
            publishAddonVersion(
                { actor: f.actor, input: { ...request(f), addonVersionId: fixed.id } },
                f.ports
            )
        ).rejects.toMatchObject({ reason: 'ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND' });
    });
});
