import { addonProducts, addons, addonVersions, eq, getDb, users } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';

/** Seed two immutable versions by INSERT for TEST:B10:9 (D-3). */
export async function seedPublicationRouteFixture() {
    const db = getDb();
    const [actor] = await db
        .insert(users)
        .values({
            email: `addon-publisher-${crypto.randomUUID()}@example.test`,
            displayName: 'Addon publisher',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    const [addon] = await db
        .insert(addons)
        .values({ slug: `publication-${crypto.randomUUID()}`, name: 'Publication fixture' })
        .returning({ id: addons.id });
    if (!actor || !addon) throw new Error('Publication fixture missing actor or addon');
    const versions = await db
        .insert(addonVersions)
        .values([
            { addonId: addon.id, validity: 'FIXED_DAYS', validityDays: 30, scopeType: 'USER' },
            { addonId: addon.id, validity: 'FIXED_DAYS', validityDays: 45, scopeType: 'USER' }
        ])
        .returning({ id: addonVersions.id });
    const [current, next] = versions;
    if (!current || !next) throw new Error('Publication fixture missing versions');
    const [product] = await db
        .insert(addonProducts)
        .values({
            addonId: addon.id,
            versionId: current.id,
            price: 5000,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            cycle: null,
            compatibleVerticals: ['accommodation']
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('Publication fixture missing product');
    return {
        actorId: actor.id,
        addonId: addon.id,
        productId: product.id,
        currentVersionId: current.id,
        nextVersionId: next.id,
        price: 5000
    };
}

/** Delete only mutable fixture rows; addon versions and domain events remain append-only. */
export async function cleanPublicationRouteFixture(
    f: Awaited<ReturnType<typeof seedPublicationRouteFixture>>
) {
    const db = getDb();
    await db.delete(addonProducts).where(eq(addonProducts.id, f.productId));
    await db.delete(users).where(eq(users.id, f.actorId));
}

/** Mock actor headers for the real route factory authorization chain. */
export function publicationActorHeaders(id: string, allowed = true) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': id,
        'x-mock-actor-role': allowed ? 'SUPER_ADMIN' : 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(
            allowed
                ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_PUBLISH_ADDON_VERSION]
                : [PermissionEnum.ACCESS_PANEL_ADMIN]
        )
    };
}
