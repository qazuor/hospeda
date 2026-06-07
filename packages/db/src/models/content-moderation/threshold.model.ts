import { and, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { contentModerationThresholds } from '../../schemas/content-moderation/threshold.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Model for content moderation thresholds (SPEC-195).
 *
 * Manages per-context pending/reject thresholds. v1 ships with a single
 * 'default' row; the schema supports per-context overrides for future use.
 */
export class ContentModerationThresholdModel extends BaseModelImpl<
    typeof contentModerationThresholds.$inferSelect
> {
    protected table = contentModerationThresholds;
    public entityName = 'contentModerationThresholds';

    protected getTableName(): string {
        return 'content_moderation_thresholds';
    }

    /**
     * Find the threshold row for a given context. Falls back to the
     * 'default' context if no context-specific row exists.
     */
    async findByContext(
        context: string,
        tx?: DrizzleClient
    ): Promise<typeof contentModerationThresholds.$inferSelect | null> {
        const db = this.getClient(tx);
        const activeFilter = isNull(contentModerationThresholds.deletedAt);

        const specific = await db
            .select()
            .from(contentModerationThresholds)
            .where(and(eq(contentModerationThresholds.context, context), activeFilter))
            .limit(1);

        const specificRow = specific[0];
        if (specificRow) return specificRow;

        if (context !== 'default') {
            const defaultRow = await db
                .select()
                .from(contentModerationThresholds)
                .where(and(eq(contentModerationThresholds.context, 'default'), activeFilter))
                .limit(1);
            const fallbackRow = defaultRow[0];
            if (fallbackRow) return fallbackRow;
        }

        return null;
    }
}
