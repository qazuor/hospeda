import type { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { revalidationConfig } from '../../schemas/revalidation/revalidation-config.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Inferred row type for the revalidation_config table.
 */
export type RevalidationConfigRecord = InferSelectModel<typeof revalidationConfig>;

/**
 * Model for the revalidation_config table.
 * Provides per-entity-type ISR revalidation configuration.
 */
export class RevalidationConfigModel extends BaseModelImpl<RevalidationConfigRecord> {
    protected table = revalidationConfig;
    public entityName = 'revalidation_config';

    protected getTableName(): string {
        return 'revalidation_config';
    }

    /**
     * Finds the revalidation configuration for the given entity type.
     *
     * @param entityType - The entity type key (e.g. 'accommodation', 'destination')
     * @returns Promise resolving to the matching config row, or undefined if not found
     */
    async findByEntityType(
        entityType: string,
        tx?: DrizzleClient
    ): Promise<RevalidationConfigRecord | undefined> {
        const db = this.getClient(tx);
        const results = await db
            .select()
            .from(revalidationConfig)
            .where(eq(revalidationConfig.entityType, entityType))
            .limit(1);
        return results[0];
    }

    /**
     * Returns all revalidation configs that are currently enabled.
     *
     * @returns Promise resolving to a readonly array of enabled config rows
     */
    async findAllEnabled(tx?: DrizzleClient): Promise<readonly RevalidationConfigRecord[]> {
        const db = this.getClient(tx);
        return db.select().from(revalidationConfig).where(eq(revalidationConfig.enabled, true));
    }
}

/** Singleton instance of RevalidationConfigModel for use across the application. */
export const revalidationConfigModel = new RevalidationConfigModel();
