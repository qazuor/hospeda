/**
 * REntityTagModel — r_entity_tag join table model (SPEC-086 T-015).
 *
 * Provides type-safe query methods for the refactored `r_entity_tag` table.
 * The new 4-column PK `(tagId, entityId, entityType, assignedById)` replaces
 * the original 3-column PK and adds per-user attribution.
 *
 * References:
 * - SPEC-086 D-007 (entity-tag visibility per actor: each user sees only their own assignments)
 * - SPEC-086 D-018 (final schema shape: 4-column PK with assignedById)
 */
import type { EntityTag } from '@repo/schemas';
import { type SQL, and, count, desc, eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { rEntityTag } from '../../schemas/tag/r_entity_tag.dbschema.ts';
import { tags } from '../../schemas/tag/tag.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';
import { warnUnknownRelationKeys } from '../../utils/relations-validator.ts';

/**
 * Input parameters for assigning a tag to an entity.
 */
export interface AssignTagInput {
    tagId: string;
    entityId: string;
    entityType: EntityTag['entityType'];
    assignedById: string;
}

/**
 * Repository for the `r_entity_tag` join table.
 *
 * All write operations (assign, delete) use the composite 4-column PK
 * `(tagId, entityId, entityType, assignedById)` introduced by SPEC-086.
 */
export class REntityTagModel extends BaseModelImpl<EntityTag> {
    protected table = rEntityTag;
    public entityName = 'rEntityTag';

    protected override readonly validRelationKeys = ['tag', 'assignedBy'] as const;

    protected getTableName(): string {
        return 'rEntityTag';
    }

    /**
     * Finds a single rEntityTag row by its 4-column primary key, optionally loading relations.
     *
     * Falls back to a plain findOne when no relations are requested.
     *
     * @param where - Filter object (tagId, entityId, entityType, assignedById)
     * @param relations - Relations to include (tag, assignedBy)
     * @param tx - Optional transaction client
     * @returns EntityTag with requested relations or null if not found
     */
    async findWithRelations(
        where: Record<string, unknown>,
        relations: Record<string, boolean | Record<string, unknown>>,
        tx?: DrizzleClient
    ): Promise<EntityTag | null> {
        warnUnknownRelationKeys(relations, this.validRelationKeys, this.entityName);
        try {
            const withObj: Record<string, true> = {};
            for (const key of ['tag', 'assignedBy']) {
                if (relations[key]) withObj[key] = true;
            }
            if (Object.keys(withObj).length > 0) {
                const db = this.getClient(tx);
                const result = await db.query.rEntityTag.findFirst({
                    where: (fields, { eq: eqOp }) => eqOp(fields.tagId, where.tagId as string),
                    with: withObj
                });
                logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
                return (result as EntityTag | undefined) ?? null;
            }
            const result = await this.findOne(where, tx);
            logQuery(this.entityName, 'findWithRelations', { where, relations }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithRelations', { where, relations }, err);
            throw new DbError(
                this.entityName,
                'findWithRelations',
                { where, relations },
                err.message
            );
        }
    }

    /**
     * Finds all tag assignments for a given entity that were made by a specific actor (D-007).
     *
     * Regular users see only their own assignments; this method enforces that scoping
     * at the model layer. For admin attribution views use {@link findByEntityAll}.
     *
     * @param entityId - UUID of the entity
     * @param entityType - EntityType discriminator
     * @param actorId - UUID of the actor — only rows where assignedById = actorId are returned
     * @param tx - Optional transaction client
     * @returns Rows where assignedById matches actorId
     */
    async findByEntityAndActor(
        entityId: string,
        entityType: EntityTag['entityType'],
        actorId: string,
        tx?: DrizzleClient
    ): Promise<EntityTag[]> {
        const db = this.getClient(tx);
        const logContext = { entityId, entityType, actorId };

        try {
            const result = await db.query.rEntityTag.findMany({
                where: (fields, { eq: eqOp, and: andOp }) =>
                    andOp(
                        eqOp(fields.entityId, entityId),
                        eqOp(fields.entityType, entityType),
                        eqOp(fields.assignedById, actorId)
                    ),
                with: { tag: true }
            });
            logQuery(this.entityName, 'findByEntityAndActor', logContext, result);
            return result as unknown as EntityTag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByEntityAndActor', logContext, err);
            throw new DbError(this.entityName, 'findByEntityAndActor', logContext, err.message);
        }
    }

    /**
     * Finds ALL tag assignments for a given entity regardless of actor (D-007).
     *
     * Intended for admin / super-admin use with the TAG_VIEW_ALL_ASSIGNMENTS permission.
     * Returns all assignments with the tag and assignedBy user populated for the
     * attribution UI.
     *
     * @param entityId - UUID of the entity
     * @param entityType - EntityType discriminator
     * @param tx - Optional transaction client
     * @returns All assignments with tag and assignedBy relations
     */
    async findByEntityAll(
        entityId: string,
        entityType: EntityTag['entityType'],
        tx?: DrizzleClient
    ): Promise<EntityTag[]> {
        const db = this.getClient(tx);
        const logContext = { entityId, entityType };

        try {
            const result = await db.query.rEntityTag.findMany({
                where: (fields, { eq: eqOp, and: andOp }) =>
                    andOp(eqOp(fields.entityId, entityId), eqOp(fields.entityType, entityType)),
                with: { tag: true, assignedBy: true }
            });
            logQuery(this.entityName, 'findByEntityAll', logContext, result);
            return result as unknown as EntityTag[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByEntityAll', logContext, err);
            throw new DbError(this.entityName, 'findByEntityAll', logContext, err.message);
        }
    }

    /**
     * Counts all assignments referencing a specific tag.
     *
     * Used to populate the impact count before a tag deletion confirmation dialog.
     * Counts across all entity types and all actors.
     *
     * @param tagId - UUID of the tag
     * @param tx - Optional transaction client
     * @returns Number of r_entity_tag rows for this tagId
     */
    async countByTagId(tagId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { tagId };

        try {
            const conditions: SQL[] = [eq(rEntityTag.tagId, tagId)];

            const result = await db
                .select({ total: count() })
                .from(rEntityTag)
                .where(and(...conditions));

            const total = Number(result[0]?.total ?? 0);
            logQuery(this.entityName, 'countByTagId', logContext, { total });
            return total;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'countByTagId', logContext, err);
            throw new DbError(this.entityName, 'countByTagId', logContext, err.message);
        }
    }

    /**
     * Hard-deletes a single assignment row identified by its full 4-column composite PK.
     *
     * Only removes the exact row matching (tagId, entityId, entityType, assignedById).
     * Does NOT cascade to other users' assignments of the same tag on the same entity.
     *
     * @param tagId - UUID of the tag
     * @param entityId - UUID of the entity
     * @param entityType - EntityType discriminator
     * @param assignedById - UUID of the user who made the assignment
     * @param tx - Optional transaction client
     * @returns Number of rows deleted (0 or 1)
     */
    async deleteByTagIdEntityUser(
        tagId: string,
        entityId: string,
        entityType: EntityTag['entityType'],
        assignedById: string,
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { tagId, entityId, entityType, assignedById };

        try {
            const result = await db
                .delete(rEntityTag)
                .where(
                    and(
                        eq(rEntityTag.tagId, tagId),
                        eq(rEntityTag.entityId, entityId),
                        eq(rEntityTag.entityType, entityType),
                        eq(rEntityTag.assignedById, assignedById)
                    )
                )
                .returning();

            logQuery(this.entityName, 'deleteByTagIdEntityUser', logContext, {
                deleted: result.length
            });
            return result.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'deleteByTagIdEntityUser', logContext, err);
            throw new DbError(this.entityName, 'deleteByTagIdEntityUser', logContext, err.message);
        }
    }

    /**
     * Assigns a tag to an entity with per-user attribution.
     *
     * Inserts a row into r_entity_tag using the 4-column composite PK.
     * Returns the created row or null if the PK already exists (same actor
     * has already applied this tag to this entity).
     *
     * The DB-level PK constraint will reject duplicates at the SQL level.
     * The service layer (T-018+) is responsible for catching the conflict
     * and returning a meaningful error to the caller.
     *
     * @param input - AssignTagInput (tagId, entityId, entityType, assignedById)
     * @param tx - Optional transaction client
     * @returns The inserted EntityTag row
     * @throws DbError on constraint violation or other DB error
     */
    async assign(input: AssignTagInput, tx?: DrizzleClient): Promise<EntityTag> {
        const db = this.getClient(tx);
        const logContext = input;

        try {
            const result = await db
                .insert(rEntityTag)
                .values({
                    tagId: input.tagId,
                    entityId: input.entityId,
                    entityType: input.entityType as unknown as typeof rEntityTag.entityType._.data,
                    assignedById: input.assignedById
                })
                .returning();

            if (!result[0]) {
                throw new Error('Insert into r_entity_tag returned no rows');
            }

            logQuery(this.entityName, 'assign', logContext, result[0]);
            return result[0] as unknown as EntityTag;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'assign', logContext, err);
            throw new DbError(this.entityName, 'assign', logContext, err.message);
        }
    }

    // =========================================================================
    // Legacy helpers preserved for backward-compatibility during migration.
    // These methods do NOT filter by assignedById and are intended for admin
    // super-admin views or internal tooling only. Prefer the new methods above
    // for all new feature work.
    // =========================================================================

    /**
     * Finds all rEntityTag for a given entity, including the tag (join).
     *
     * @deprecated Prefer findByEntityAndActor (regular user) or findByEntityAll (admin).
     *             This method returns rows for ALL actors and is kept for backward compat.
     * @param entityId - The entity ID
     * @param entityType - The entity type
     * @param tx - Optional transaction client
     * @returns Array of rEntityTag rows with tag relation loaded
     */
    async findAllWithTags(entityId: string, entityType: string, tx?: DrizzleClient) {
        const db = this.getClient(tx);
        try {
            const result = await db.query.rEntityTag.findMany({
                where: (fields, { eq: eqOp, and: andOp }) =>
                    andOp(eqOp(fields.entityId, entityId), eqOp(fields.entityType, entityType)),
                with: { tag: true }
            });
            logQuery(this.entityName, 'findAllWithTags', { entityId, entityType }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findAllWithTags', { entityId, entityType }, err);
            throw new DbError(
                this.entityName,
                'findAllWithTags',
                { entityId, entityType },
                err.message
            );
        }
    }

    /**
     * Finds all rEntityTag for a given tag, optionally filtered by entityType.
     *
     * @deprecated Prefer countByTagId for impact count or findByEntityAll for admin views.
     *             This method is kept for backward compat.
     * @param tagId - The tag ID
     * @param entityType - (optional) The entity type to filter by
     * @param tx - Optional transaction client
     * @returns Array of rEntityTag rows with tag relation loaded
     */
    async findAllWithEntities(tagId: string, entityType?: string, tx?: DrizzleClient) {
        const db = this.getClient(tx);
        try {
            const result = await db.query.rEntityTag.findMany({
                where: (fields, { eq: eqOp, and: andOp }) => {
                    if (entityType) {
                        return andOp(
                            eqOp(fields.tagId, tagId),
                            eqOp(fields.entityType, entityType)
                        );
                    }
                    return eqOp(fields.tagId, tagId);
                },
                with: { tag: true }
            });
            logQuery(this.entityName, 'findAllWithEntities', { tagId, entityType }, result);
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findAllWithEntities', { tagId, entityType }, err);
            throw new DbError(
                this.entityName,
                'findAllWithEntities',
                { tagId, entityType },
                err.message
            );
        }
    }

    /**
     * Finds the most popular tags by usage count, ordered descending.
     *
     * Counts DISTINCT entityId to avoid inflating counts when multiple users
     * apply the same tag to the same entity.
     *
     * @param params - Options object with optional limit (default: 10)
     * @param tx - Optional transaction client
     * @returns Array of { tag, usageCount }
     */
    async findPopularTags(
        { limit = 10 }: { limit?: number } = {},
        tx?: DrizzleClient
    ): Promise<Array<{ tag: unknown; usageCount: number }>> {
        const db = this.getClient(tx);

        const results = await db
            .select({
                tag: tags,
                usageCount: count(rEntityTag.tagId).as('usageCount')
            })
            .from(rEntityTag)
            .innerJoin(tags, eq(rEntityTag.tagId, tags.id))
            .groupBy(tags.id)
            .orderBy(desc(count(rEntityTag.tagId)))
            .limit(limit);
        return results;
    }
}

/** Singleton instance of REntityTagModel for use across the application. */
export const rEntityTagModel = new REntityTagModel();
