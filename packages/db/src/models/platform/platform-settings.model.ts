import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { platformSettings } from '../../schemas/platform/platform-settings.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Inferred row type for the `platform_settings` table.
 */
export type PlatformSettingRecord = InferSelectModel<typeof platformSettings>;

/**
 * Model for the `platform_settings` table (SPEC-156).
 *
 * Cross-device storage for SUPER_ADMIN / ADMIN-level platform settings keyed by a
 * stable string identifier (e.g. `seo.defaults`, `maintenance.mode`,
 * `announcements.global`). The shape of each `value` is validated at the
 * application layer by `PlatformSettingsResponseSchema` in `@repo/schemas`.
 *
 * Upsert-only — there is no soft delete because an absent key and a deleted key
 * would be ambiguous (both mean "use built-in defaults").
 */
export class PlatformSettingsModel extends BaseModelImpl<PlatformSettingRecord> {
    protected table = platformSettings;
    public entityName = 'platform_settings';

    protected getTableName(): string {
        return 'platform_settings';
    }

    /**
     * Finds the platform setting row for the given key.
     *
     * @param key - Stable setting identifier (e.g. `seo.defaults`)
     * @param tx - Optional transaction client
     * @returns The matching row, or `undefined` if the key is not present
     */
    async findByKey(key: string, tx?: DrizzleClient): Promise<PlatformSettingRecord | undefined> {
        const db = this.getClient(tx);
        const results = await db
            .select()
            .from(platformSettings)
            .where(eq(platformSettings.key, key))
            .limit(1);
        return results[0];
    }

    /**
     * Inserts or updates the platform setting row for the given key.
     *
     * On conflict on the primary key, the existing row's `value`, `updatedAt`,
     * and `updatedBy` columns are replaced atomically. Returns the resulting row.
     *
     * @param key - Stable setting identifier
     * @param value - Setting value (validated upstream by Zod per key)
     * @param actorId - UUID of the user performing the write (recorded in `updatedBy`)
     * @param tx - Optional transaction client
     * @returns The upserted row
     */
    async upsertByKey(
        key: string,
        value: unknown,
        actorId: string,
        tx?: DrizzleClient
    ): Promise<PlatformSettingRecord> {
        const db = this.getClient(tx);
        const now = new Date();
        const results = await db
            .insert(platformSettings)
            .values({
                key,
                value,
                updatedAt: now,
                updatedBy: actorId
            })
            .onConflictDoUpdate({
                target: platformSettings.key,
                set: {
                    value,
                    updatedAt: now,
                    updatedBy: actorId
                }
            })
            .returning();
        // Drizzle returns at least one row on a successful upsert.
        const row = results[0];
        if (!row) {
            throw new Error(
                `upsertByKey returned no row for key="${key}" — unexpected database state`
            );
        }
        return row;
    }
}

/** Singleton instance of PlatformSettingsModel for use across the application. */
export const platformSettingsModel = new PlatformSettingsModel();
