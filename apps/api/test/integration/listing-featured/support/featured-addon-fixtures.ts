import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    addons,
    addonVersionEntitlements,
    addonVersions,
    eq,
    getDb
} from '@repo/db';
import type { PublicationVertical } from '@repo/verticals';

/** Seeds one committed listing boost so the production coverage reader can see it. */
export async function seedListingBoost(args: {
    readonly ownerId: string;
    readonly listingId: string;
    readonly vertical: PublicationVertical;
    readonly grantsFeatured?: boolean;
    readonly endsAt?: Date | null;
    readonly status?: 'ACTIVE' | 'CANCELLED';
}): Promise<{ readonly instanceId: string }> {
    const db = getDb();
    return db.transaction(async (tx) => {
        const [addon] = await tx
            .insert(addons)
            .values({ slug: `hos1718-${randomUUID()}`, name: 'Featured listing boost' })
            .returning({ id: addons.id });
        if (!addon) throw new Error('Expected addon fixture');
        const [version] = await tx
            .insert(addonVersions)
            .values({
                addonId: addon.id,
                validity: 'FIXED_DAYS',
                validityDays: 7,
                scopeType: 'LISTING'
            })
            .returning({ id: addonVersions.id });
        if (!version) throw new Error('Expected addon version fixture');
        if (args.grantsFeatured !== false)
            await tx
                .insert(addonVersionEntitlements)
                .values({ addonVersionId: version.id, key: 'featured_listing' });
        const [product] = await tx
            .insert(addonProducts)
            .values({
                addonId: addon.id,
                versionId: version.id,
                price: 1000,
                currency: 'ARS',
                chargeKind: 'UNA_VEZ',
                cycle: null,
                compatibleVerticals: [args.vertical]
            })
            .returning({ id: addonProducts.id });
        if (!product) throw new Error('Expected addon product fixture');
        const [instance] = await tx
            .insert(addonInstances)
            .values({
                productId: product.id,
                addonVersionId: version.id,
                ownerId: args.ownerId,
                targetId: args.listingId,
                status: args.status ?? 'ACTIVE',
                startsAt: new Date('2026-10-01T00:00:00.000Z'),
                endsAt:
                    args.endsAt === undefined ? new Date('2026-12-01T00:00:00.000Z') : args.endsAt
            })
            .returning({ id: addonInstances.id });
        if (!instance) throw new Error('Expected addon instance fixture');
        return { instanceId: instance.id };
    });
}

/** Deletes only mutable instances; catalog versions are immutable by design. */
export async function deleteListingBoosts(instanceIds: readonly string[]): Promise<void> {
    for (const id of instanceIds)
        await getDb().delete(addonInstances).where(eq(addonInstances.id, id));
}
