import { and, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { contentModerationTerms } from '../../schemas/content-moderation/term.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Model for content moderation terms (SPEC-195).
 *
 * Manages the blocked words and domains used by the local moderation provider.
 * Extends BaseModelImpl for standard CRUD, soft-delete, and restore operations.
 */
export class ContentModerationTermModel extends BaseModelImpl<
    typeof contentModerationTerms.$inferSelect
> {
    protected table = contentModerationTerms;
    public entityName = 'contentModerationTerms';

    protected getTableName(): string {
        return 'content_moderation_terms';
    }

    /**
     * Find all enabled, non-deleted terms. This is the engine hot-path
     * query used by the local moderation provider.
     */
    async findEnabledTerms(
        tx?: DrizzleClient
    ): Promise<Array<typeof contentModerationTerms.$inferSelect>> {
        const db = this.getClient(tx);
        return db
            .select()
            .from(contentModerationTerms)
            .where(
                and(
                    eq(contentModerationTerms.enabled, true),
                    isNull(contentModerationTerms.deletedAt)
                )
            );
    }
}
