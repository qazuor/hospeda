import { type SQL, and, asc, count, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { entityComments } from '../../schemas/entity-comment/entity_comment.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Row shape inferred directly from the `entity_comments` Drizzle table.
 *
 * The model is intentionally typed against the inferred select type rather than
 * a `@repo/schemas` domain type: T-002 (this model) precedes T-005 (the Zod
 * schemas) in the SPEC-165 dependency order, so the canonical `EntityComment`
 * type does not exist yet. The service layer (T-006/T-007) maps this row to the
 * public/admin DTOs.
 */
export type EntityCommentRecord = typeof entityComments.$inferSelect;

/**
 * Model for polymorphic post/event comments (SPEC-165). Inherits the standard
 * CRUD, soft/hard delete, restore, and pagination methods from {@link BaseModelImpl}
 * (`findById`, `softDelete`, `hardDelete`, `restore`, `findAll`, `count`, ...).
 *
 * Adds two query helpers the comment service needs that are not expressible via
 * the generic base methods:
 * - {@link findByEntity}: the per-entity comment thread, optionally including
 *   soft-deleted rows.
 * - {@link countApprovedByPostId}: the authoritative recount used to keep the
 *   `posts.comments` integer counter in sync.
 */
export class EntityCommentModel extends BaseModelImpl<EntityCommentRecord> {
    protected table = entityComments;
    public entityName = 'entityComments';

    protected override readonly validRelationKeys = ['author'] as const;

    protected getTableName(): string {
        return 'entityComments';
    }

    /**
     * Returns every comment attached to a given entity, ordered oldest-first
     * (natural thread order). Soft-deleted rows are excluded unless
     * `includeDeleted` is `true`.
     *
     * Moderation-state filtering and pagination are deliberately NOT applied
     * here; callers that need the public APPROVED-only paginated thread compose
     * those constraints in the service layer (or via the base `findAll`).
     *
     * @param params.entityId - The owning entity id (post or event).
     * @param params.entityType - The owning entity type.
     * @param params.includeDeleted - Include soft-deleted rows. Defaults to `false`.
     * @param params.tx - Optional transaction client.
     * @returns The matching comment rows, ordered by `createdAt` ascending.
     */
    async findByEntity(params: {
        entityId: string;
        entityType: EntityCommentRecord['entityType'];
        includeDeleted?: boolean;
        tx?: DrizzleClient;
    }): Promise<EntityCommentRecord[]> {
        const { entityId, entityType, includeDeleted = false, tx } = params;
        const db = this.getClient(tx);
        const logContext = { entityId, entityType, includeDeleted };

        try {
            const conditions: SQL[] = [
                eq(this.table.entityId, entityId),
                eq(this.table.entityType, entityType)
            ];
            if (!includeDeleted) {
                conditions.push(isNull(this.table.deletedAt));
            }

            const items = await db
                .select()
                .from(this.table)
                .where(and(...conditions))
                .orderBy(asc(this.table.createdAt));

            try {
                logQuery(this.entityName, 'findByEntity', logContext, { count: items.length });
            } catch {}
            return items;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findByEntity', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findByEntity', logContext, err.message);
        }
    }

    /**
     * Counts the non-deleted, APPROVED comments attached to a post. This is the
     * authoritative recount used to repair the `posts.comments` integer counter
     * after a soft-delete, restore, or moderation-state transition.
     *
     * @param params.postId - The post id (the `entityId` of POST comments).
     * @param params.tx - Optional transaction client (use the same tx as the
     *   mutating write so the recount is consistent within the transaction).
     * @returns The number of APPROVED, non-deleted POST comments for the post.
     */
    async countApprovedByPostId(params: {
        postId: string;
        tx?: DrizzleClient;
    }): Promise<number> {
        const { postId, tx } = params;
        const db = this.getClient(tx);
        const logContext = { postId };

        try {
            const [row] = await db
                .select({ value: count() })
                .from(this.table)
                .where(
                    and(
                        eq(this.table.entityType, 'POST'),
                        eq(this.table.entityId, postId),
                        eq(this.table.moderationState, 'APPROVED'),
                        isNull(this.table.deletedAt)
                    )
                );

            const value = row?.value ?? 0;
            try {
                logQuery(this.entityName, 'countApprovedByPostId', logContext, { value });
            } catch {}
            return value;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countApprovedByPostId', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'countApprovedByPostId', logContext, err.message);
        }
    }
}

/** Singleton instance of EntityCommentModel for use across the application. */
export const entityCommentModel = new EntityCommentModel();
