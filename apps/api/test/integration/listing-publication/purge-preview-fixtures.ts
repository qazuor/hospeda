import { randomUUID } from 'node:crypto';
import { addonInstances, addonProducts, addons, addonVersions, getDb, inArray } from '@repo/db';
import type { VerticalEnum } from '@repo/schemas';

let fixtureOrder = 0;

/** Inserts one complete add-on catalog and acquired-instance fixture. */
export async function seedPurgePreviewAddon(args: {
    readonly ownerId: string;
    readonly targetId: string | null;
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly vertical: VerticalEnum;
    readonly status?: 'PENDING_AUTHORIZATION' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'ABANDONED';
    readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
    readonly cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null;
    readonly price?: number;
    readonly endsAt?: Date | null;
    readonly name?: string;
}): Promise<{ readonly instanceId: string }> {
    return getDb().transaction(async (tx) => {
        const [addon] = await tx
            .insert(addons)
            .values({ slug: `purge-preview-${randomUUID()}`, name: args.name ?? 'Listing add-on' })
            .returning({ id: addons.id });
        if (!addon) throw new Error('Purge preview addon fixture insert failed');
        const [version] = await tx
            .insert(addonVersions)
            .values({
                addonId: addon.id,
                validity: args.endsAt ? 'FIXED_DAYS' : 'WHILE_SUBSCRIPTION_ALIVE',
                validityDays: args.endsAt ? 30 : null,
                scopeType: args.scopeType
            })
            .returning({ id: addonVersions.id });
        if (!version) throw new Error('Purge preview addon version fixture insert failed');
        const chargeKind = args.chargeKind ?? 'UNA_VEZ';
        const [product] = await tx
            .insert(addonProducts)
            .values({
                addonId: addon.id,
                versionId: version.id,
                price: args.price ?? 250000,
                currency: 'ARS',
                chargeKind,
                cycle:
                    args.cycle === undefined
                        ? chargeKind === 'PERIODICO'
                            ? 'monthly'
                            : null
                        : args.cycle,
                compatibleVerticals: [args.vertical]
            })
            .returning({ id: addonProducts.id });
        if (!product) throw new Error('Purge preview product fixture insert failed');
        const [instance] = await tx
            .insert(addonInstances)
            .values({
                productId: product.id,
                addonVersionId: version.id,
                ownerId: args.ownerId,
                targetId: args.targetId,
                status: args.status ?? 'ACTIVE',
                startsAt: new Date('2026-10-01T10:00:00.000Z'),
                endsAt: args.endsAt ?? null,
                createdAt: new Date(Date.parse('2026-10-01T10:00:00.000Z') + fixtureOrder++)
            })
            .returning({ id: addonInstances.id });
        if (!instance) throw new Error('Purge preview instance fixture insert failed');
        return { instanceId: instance.id };
    });
}

/** Deletes only the add-on instances seeded by this test, before owner cleanup. */
export async function deletePurgePreviewInstances(args: {
    readonly instanceIds: readonly string[];
}): Promise<void> {
    if (args.instanceIds.length === 0) return;
    await getDb()
        .delete(addonInstances)
        .where(inArray(addonInstances.id, [...args.instanceIds]));
}
