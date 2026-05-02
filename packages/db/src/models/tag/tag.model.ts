/**
 * TagModel — User-Tag subsystem model (SPEC-086 T-015).
 *
 * Provides type-safe query methods for the refactored `tags` table.
 * The three-type model (INTERNAL / SYSTEM / USER) replaces the original single-pool design.
 *
 * References:
 * - SPEC-086 D-002 (TagTypeEnum: three values, no scope)
 * - SPEC-086 D-006 (picker visibility per actor)
 * - SPEC-086 D-007 (entity-tag visibility per actor)
 * - SPEC-086 D-014 (safeIlike on name only)
 * - SPEC-086 D-018 (final schema shape)
 * - SPEC-086 D-021 (quota enforcement)
 */
import type { Tag } from '@repo/schemas';
import { TagTypeEnum } from '@repo/schemas';
import { type SQL, and, count, eq, isNull, or } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { tags } from '../../schemas/tag/tag.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { safeIlike } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Input parameters for {@link TagModel.findPickerTags}.
 */
export interface FindPickerTagsInput {
    /** UUID of the actor requesting the picker. */
    actorId: string;
    /**
     * Whether the actor has internal-view permission (TAG_INTERNAL_VIEW).
     * When true, INTERNAL tags are included in picker results (D-006).
     */
    hasInternalView: boolean;
    /** Optional text query for name substring search (safeIlike, D-014). */
    nameQuery?: string;
}

/**
 * Repository for the `tags` table (User-Tag subsystem).
 *
 * Extends BaseModelImpl for standard CRUD operations and adds
 * tag-system-specific query methods per SPEC-086.
 */
export class TagModel extends BaseModelImpl<Tag> {
    protected table = tags;
    public entityName = 'tags';

    protected getTableName(): string {
        return 'tags';
    }

    /**
     * Finds all tags of a specific type, with optional lifecycle filter.
     *
     * Used by admin list views to display tags by type (INTERNAL, SYSTEM).
     *
     * @param type - TagTypeEnum value to filter by
     * @param options - Optional filters: lifecycleState for additional filtering
     * @param tx - Optional transaction client
     * @returns All matching tags (no pagination — callers must page via findAll)
     */
    async findByType(
        type: TagTypeEnum,
        options?: { lifecycleState?: Tag['lifecycleState'] },
        tx?: DrizzleClient
    ): Promise<Tag[]> {
        const db = this.getClient(tx);
        const logContext = { type, options };

        try {
            // DRIZZLE-LIMITATION: pgEnum columns brand their `_.data` type with the schema name; eq() rejects raw enum strings until cast.
            const conditions: SQL[] = [eq(tags.type, type as unknown as typeof tags.type._.data)];
            if (options?.lifecycleState) {
                conditions.push(
                    eq(
                        tags.lifecycleState,
                        // DRIZZLE-LIMITATION: same branded-enum issue as above for lifecycleState.
                        options.lifecycleState as unknown as typeof tags.lifecycleState._.data
                    )
                );
            }
            // Exclude soft-deleted rows
            conditions.push(isNull(tags.deletedAt));

            const result = await db
                .select()
                .from(tags)
                .where(and(...conditions));

            logQuery(this.entityName, 'findByType', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical Tag type used by services.
            return result as unknown as Tag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByType', logContext, err);
            throw new DbError(this.entityName, 'findByType', logContext, err.message);
        }
    }

    /**
     * Finds all USER tags belonging to a specific owner.
     *
     * Used by the own-tag manager (all lifecycle states) and moderation view.
     * Excludes soft-deleted rows. Does NOT filter by lifecycleState so the
     * manager can show ACTIVE, DRAFT, and ARCHIVED tags with visual distinction.
     *
     * @param ownerId - UUID of the tag owner
     * @param tx - Optional transaction client
     * @returns All USER tags for the given owner
     */
    async findByOwner(ownerId: string, tx?: DrizzleClient): Promise<Tag[]> {
        const db = this.getClient(tx);
        const logContext = { ownerId };

        try {
            const result = await db
                .select()
                .from(tags)
                .where(
                    // DRIZZLE-LIMITATION: TagTypeEnum is a TS enum, but tags.type column carries Drizzle's branded `_.data` type; eq() rejects until cast.
                    and(
                        eq(tags.type, TagTypeEnum.USER as unknown as typeof tags.type._.data),
                        eq(tags.ownerId, ownerId),
                        isNull(tags.deletedAt)
                    )
                );

            logQuery(this.entityName, 'findByOwner', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical Tag type used by services.
            return result as unknown as Tag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByOwner', logContext, err);
            throw new DbError(this.entityName, 'findByOwner', logContext, err.message);
        }
    }

    /**
     * Counts the number of ACTIVE USER tags for a given owner.
     *
     * Used for quota enforcement (D-021). Counts only:
     *   - type = USER
     *   - lifecycleState = ACTIVE
     *   - not soft-deleted
     *
     * NOTE: The caller (service layer, T-019) is responsible for wrapping this
     * in an advisory lock before a create to prevent concurrent quota races (D-010).
     *
     * @param ownerId - UUID of the user whose quota is being checked
     * @param tx - Optional transaction client (must be provided when called under advisory lock)
     * @returns Count of active USER tags for this owner
     */
    async countActiveByOwner(ownerId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { ownerId };

        try {
            const result = await db
                .select({ total: count() })
                .from(tags)
                .where(
                    // DRIZZLE-LIMITATION: TS enum/string literal vs Drizzle branded enum types; both `tags.type` and `tags.lifecycleState` need the cast.
                    and(
                        eq(tags.type, TagTypeEnum.USER as unknown as typeof tags.type._.data),
                        eq(tags.ownerId, ownerId),
                        eq(
                            tags.lifecycleState,
                            // DRIZZLE-LIMITATION: pgEnum branded `_.data` type rejects raw 'ACTIVE' string until cast.
                            'ACTIVE' as unknown as typeof tags.lifecycleState._.data
                        ),
                        isNull(tags.deletedAt)
                    )
                );

            const total = Number(result[0]?.total ?? 0);
            logQuery(this.entityName, 'countActiveByOwner', logContext, { total });
            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'countActiveByOwner', logContext, err);
            throw new DbError(this.entityName, 'countActiveByOwner', logContext, err.message);
        }
    }

    /**
     * Returns the tags visible in the actor's picker (D-006).
     *
     * Single source of truth for picker visibility:
     * - Always includes SYSTEM (ACTIVE) tags
     * - Always includes the actor's own USER (ACTIVE) tags
     * - Includes INTERNAL (ACTIVE) tags only when hasInternalView is true
     * - Optionally filters by name substring (safeIlike, D-014)
     *
     * Anonymous actors are not supported — the caller must ensure an authenticated
     * actor before calling this method.
     *
     * @param input - FindPickerTagsInput
     * @param tx - Optional transaction client
     * @returns Array of Tag rows visible in the picker
     */
    async findPickerTags(input: FindPickerTagsInput, tx?: DrizzleClient): Promise<Tag[]> {
        const db = this.getClient(tx);
        const { actorId, hasInternalView, nameQuery } = input;
        const logContext = { actorId, hasInternalView, nameQuery };

        try {
            // Build per-type conditions using SQL OR blocks so we can apply
            // a single name filter across the entire result set.

            // DRIZZLE-LIMITATION: every TagTypeEnum / lifecycle literal needs to be cast to Drizzle's branded `_.data` type; this block has 3 branches that all hit the same brand mismatch.
            // Condition: SYSTEM (ACTIVE)
            const systemCondition: SQL = and(
                eq(tags.type, TagTypeEnum.SYSTEM as unknown as typeof tags.type._.data),
                eq(tags.lifecycleState, 'ACTIVE' as unknown as typeof tags.lifecycleState._.data),
                isNull(tags.deletedAt)
            ) as SQL;

            // DRIZZLE-LIMITATION: same branded-enum cast applies to user condition.
            // Condition: actor's own USER (ACTIVE)
            const userCondition: SQL = and(
                eq(tags.type, TagTypeEnum.USER as unknown as typeof tags.type._.data),
                eq(tags.ownerId, actorId),
                eq(tags.lifecycleState, 'ACTIVE' as unknown as typeof tags.lifecycleState._.data),
                isNull(tags.deletedAt)
            ) as SQL;

            const orBranches: SQL[] = [systemCondition, userCondition];

            if (hasInternalView) {
                // DRIZZLE-LIMITATION: same branded-enum cast applies to internal condition.
                // Condition: INTERNAL (ACTIVE) — only for actors with TAG_INTERNAL_VIEW
                const internalCondition: SQL = and(
                    eq(tags.type, TagTypeEnum.INTERNAL as unknown as typeof tags.type._.data),
                    eq(
                        tags.lifecycleState,
                        // DRIZZLE-LIMITATION: pgEnum branded `_.data` type rejects raw 'ACTIVE' string until cast.
                        'ACTIVE' as unknown as typeof tags.lifecycleState._.data
                    ),
                    isNull(tags.deletedAt)
                ) as SQL;
                orBranches.push(internalCondition);
            }

            // Build the visibility filter as an OR of all branches.
            const visibilityFilter = or(...orBranches) as SQL;

            // Apply optional name search (D-014: safeIlike on name only)
            const conditions: SQL[] = [visibilityFilter];
            if (nameQuery?.trim()) {
                conditions.push(safeIlike(tags.name, nameQuery.trim()));
            }

            const result = await db
                .select()
                .from(tags)
                .where(and(...conditions));

            logQuery(this.entityName, 'findPickerTags', logContext, result);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with branded enum columns; cast back to the canonical Tag type used by services.
            return result as unknown as Tag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findPickerTags', logContext, err);
            throw new DbError(this.entityName, 'findPickerTags', logContext, err.message);
        }
    }
}

/** Singleton instance of TagModel for use across the application. */
export const tagModel = new TagModel();
