import { addons, addonVersionLimits, addonVersions, eq, sql } from '@repo/db';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { getServiceTestDb } from '../helpers.js';

const owned: Array<{ addonId: string; versionId: string }> = [];

/** Seeds one immutable addon version and its optional limit in the same transaction. */
export async function seedAddonNoticeVersion(value?: number) {
    const result = await getServiceTestDb().transaction(async (tx) => {
        const [addon] = await tx
            .insert(addons)
            .values({
                slug: `notice-${crypto.randomUUID()}`,
                name: 'Notice fixture'
            })
            .returning({ id: addons.id });
        if (!addon) throw new Error('Addon fixture missing');
        const [version] = await tx
            .insert(addonVersions)
            .values({
                addonId: addon.id,
                validity: 'WHILE_SUBSCRIPTION_ALIVE',
                scopeType: 'VERTICAL_SUBSCRIPTION'
            })
            .returning({ id: addonVersions.id });
        if (!version) throw new Error('Addon version fixture missing');
        if (value !== undefined)
            await tx.insert(addonVersionLimits).values({
                addonVersionId: version.id,
                key: PUBLICATION_LIMIT_KEYS.accommodation,
                value
            });
        return { addonId: addon.id, versionId: version.id };
    });
    owned.push(result);
    return result;
}

/** Deletes this fixture's immutable catalog rows with their own triggers disabled locally. */
export async function retireAddonNoticeVersions(): Promise<void> {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        await db.transaction(async (tx) => {
            await tx.execute(
                sql`ALTER TABLE addon_version_limit DISABLE TRIGGER trg_addon_version_limit_immutable`
            );
            await tx.execute(
                sql`ALTER TABLE addon_version DISABLE TRIGGER trg_addon_version_immutable`
            );
            await tx
                .delete(addonVersionLimits)
                .where(eq(addonVersionLimits.addonVersionId, row.versionId));
            await tx.delete(addonVersions).where(eq(addonVersions.id, row.versionId));
            await tx.delete(addons).where(eq(addons.id, row.addonId));
            await tx.execute(
                sql`ALTER TABLE addon_version ENABLE TRIGGER trg_addon_version_immutable`
            );
            await tx.execute(
                sql`ALTER TABLE addon_version_limit ENABLE TRIGGER trg_addon_version_limit_immutable`
            );
        });
    }
}
