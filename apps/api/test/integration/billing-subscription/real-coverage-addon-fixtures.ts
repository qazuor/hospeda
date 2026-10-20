/**
 * Committed addon rows for the G-R2-C case of the real implementation's own
 * case set (B4 "Lista cuando", clause 7; AC:B4:8, AC:B4:10; HOS-1536).
 *
 * A local copy of `seedCoverageAddon`, `seedCoverageAddonProduct` and
 * `seedCoverageAddonInstance` from service-core's integration fixtures (test
 * support of another package), writing through `getDb()` and COMMITTING: the
 * real `coverage()` reads with its own connection, so rows inside a test
 * transaction would be invisible to it.
 *
 * Only `addon_instance` is deleted afterwards (before the user it belongs
 * to). `addon`, `addon_version` (immutable by trigger, extras 041) and
 * `addon_product` stay, as plans do.
 *
 * Test support, not a `*.test.ts` file: the closed `include` of the
 * integration config never collects it on its own.
 */
import { randomUUID } from 'node:crypto';
import { addonInstances, addonProducts, addons, addonVersions, getDb, inArray } from '@repo/db';
import type { VerticalEnum } from '@repo/schemas';

/** When every seeded instance starts. */
const INSTANCE_STARTS_AT = new Date('2026-10-03T10:00:00.000Z');

/**
 * Seeds one live (`ACTIVE`, `WHILE_SUBSCRIPTION_ALIVE`) addon instance of the
 * person, of the given scope type, whose product is compatible ONLY with the
 * given vertical.
 *
 * @param args.ownerId - The person who owns the instance
 * @param args.scopeType - `USER` or `GLOBAL`
 * @param args.compatibleVertical - The only vertical the product declares compatible
 * @returns `{ instanceId }`, for cleanup
 */
async function seedCompatibleAddonInstance(args: {
    readonly ownerId: string;
    readonly scopeType: 'USER' | 'GLOBAL';
    readonly compatibleVertical: VerticalEnum;
}): Promise<{ readonly instanceId: string }> {
    return getDb().transaction(async (tx) => {
        const [addon] = await tx
            .insert(addons)
            .values({ slug: `b45-g-r2-c-${randomUUID()}`, name: 'B4.5 G-R2-C addon' })
            .returning({ id: addons.id });
        if (!addon) throw new Error('b45 fixture addon missing');
        const [version] = await tx
            .insert(addonVersions)
            .values({
                addonId: addon.id,
                validity: 'WHILE_SUBSCRIPTION_ALIVE',
                validityDays: null,
                scopeType: args.scopeType
            })
            .returning({ id: addonVersions.id });
        if (!version) throw new Error('b45 fixture addon version missing');
        const [product] = await tx
            .insert(addonProducts)
            .values({
                addonId: addon.id,
                versionId: version.id,
                price: 10000,
                currency: 'ARS',
                chargeKind: 'UNA_VEZ',
                cycle: null,
                compatibleVerticals: [args.compatibleVertical]
            })
            .returning({ id: addonProducts.id });
        if (!product) throw new Error('b45 fixture addon product missing');
        const [instance] = await tx
            .insert(addonInstances)
            .values({
                productId: product.id,
                addonVersionId: version.id,
                ownerId: args.ownerId,
                status: 'ACTIVE',
                targetId: null,
                startsAt: INSTANCE_STARTS_AT,
                endsAt: null
            })
            .returning({ id: addonInstances.id });
        if (!instance) throw new Error('b45 fixture addon instance missing');
        return { instanceId: instance.id };
    });
}

/**
 * Seeds a `USER` and a `GLOBAL` addon instance of the person, both of products
 * compatible ONLY with `compatibleVertical`.
 *
 * @param args.userId - The person who owns both instances
 * @param args.compatibleVertical - The only vertical both products declare compatible
 * @returns `{ instanceIds }`, for cleanup
 */
export async function seedUserAndGlobalAddons(args: {
    readonly userId: string;
    readonly compatibleVertical: VerticalEnum;
}): Promise<{ readonly instanceIds: readonly string[] }> {
    const instanceIds: string[] = [];
    for (const scopeType of ['USER', 'GLOBAL'] as const) {
        const { instanceId } = await seedCompatibleAddonInstance({
            ownerId: args.userId,
            scopeType,
            compatibleVertical: args.compatibleVertical
        });
        instanceIds.push(instanceId);
    }
    return { instanceIds };
}

/**
 * Deletes the given addon instances (call it before deleting their owners).
 *
 * @param args.instanceIds - The instances to delete
 */
export async function deleteAddonInstances(args: {
    readonly instanceIds: readonly string[];
}): Promise<void> {
    if (args.instanceIds.length === 0) return;
    await getDb()
        .delete(addonInstances)
        .where(inArray(addonInstances.id, [...args.instanceIds]));
}
