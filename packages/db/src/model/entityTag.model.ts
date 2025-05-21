import { dbLogger } from '@repo/db/utils/logger.js';
import type { EntityTypeEnum } from '@repo/types';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { entityTagRelations } from '../schema/r_entity_tag.dbschema.js';
import type { InsertEntityTagRelation, SelectEntityTagRelationFilter } from '../types/db-types.js';
import { assertExists, castReturning } from '../utils/db-utils.js';

/**
 * Full entity tag relation record as returned by the database.
 */
export type EntityTagRecord = InferSelectModel<typeof entityTagRelations>;

/**
 * EntityTagModel provides low-level CRUD operations for the r_entity_tag table.
 */
export const EntityTagModel = {
    /**
     * Create a new entity tag relation.
     *
     * @param data - Fields required to create the relation (InsertEntityTagRelation type from db-types)
     * @returns The created relation record
     */
    async createRelation(data: InsertEntityTagRelation): Promise<EntityTagRecord> {
        try {
            dbLogger.info(data, 'creating entity tag relation');
            const db = getDb();
            const rows = castReturning<EntityTagRecord>(
                await db.insert(entityTagRelations).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            dbLogger.query({
                table: 'r_entity_tag',
                action: 'insert',
                params: data,
                result: relation
            });
            return relation;
        } catch (error) {
            dbLogger.error(error, 'createRelation failed');
            throw error;
        }
    },

    /**
     * List entity tag relations with optional filters and pagination.
     *
     * @param filter - Filtering and pagination options (SelectEntityTagRelationFilter type from db-types)
     * @returns Array of relation records
     */
    async listRelations(filter: SelectEntityTagRelationFilter = {}): Promise<EntityTagRecord[]> {
        try {
            dbLogger.info(filter, 'listing entity tag relations');
            const db = getDb();
            let query = db.select().from(entityTagRelations).$dynamic();

            if (filter.entityType) {
                query = query.where(eq(entityTagRelations.entityType, filter.entityType));
            }

            if (filter.entityId) {
                query = query.where(eq(entityTagRelations.entityId, filter.entityId));
            }

            if (filter.tagId) {
                query = query.where(eq(entityTagRelations.tagId, filter.tagId));
            }

            // Removed filters for createdById, updatedById, deletedById as they do not exist in schema
            // if (filter.createdById) { query = query.where(eq(entityTagRelations.createdById, filter.createdById)); }
            // if (filter.updatedById) { query = query.where(eq(entityTagRelations.updatedById, filter.updatedById)); }
            // if (filter.deletedById) { query = query.where(eq(entityTagRelations.deletedById, filter.deletedById)); }

            // Note: No fuzzy search implemented for this join table based on common fields
            // if (filter.query) { ... }

            // Relation tables typically don't have deletedAt timestamp.
            // If soft-delete was implemented on this table, the filter.includeDeleted logic would apply.
            // Based on schema, it does NOT have deletedAt.
            // if (!filter.includeDeleted) { ... }

            // getOrderByColumn is not suitable as there's no single primary timestamp/column for ordering.
            // Defaulting to ordering by the relation keys as they form the primary key.
            query = query.orderBy(
                entityTagRelations.entityType,
                entityTagRelations.entityId,
                entityTagRelations.tagId
            );

            const rows = (await query
                .limit(filter.limit ?? 20)
                .offset(filter.offset ?? 0)) as EntityTagRecord[];

            dbLogger.query({
                table: 'r_entity_tag',
                action: 'select',
                params: filter,
                result: rows
            });
            return rows;
        } catch (error) {
            dbLogger.error(error, 'listRelations failed');
            throw error;
        }
    },

    /**
     * Delete an entity tag relation.
     *
     * @param entityType - The type of entity
     * @param entityId - The ID of the entity
     * @param tagId - The ID of the tag
     */
    async deleteRelation(
        entityType: EntityTypeEnum,
        entityId: string,
        tagId: string
    ): Promise<void> {
        try {
            dbLogger.info({ entityType, entityId, tagId }, 'deleting entity tag relation');
            const db = getDb();
            await db
                .delete(entityTagRelations)
                .where(
                    and(
                        eq(entityTagRelations.entityType, entityType),
                        eq(entityTagRelations.entityId, entityId),
                        eq(entityTagRelations.tagId, tagId)
                    )
                );
            dbLogger.query({
                table: 'r_entity_tag',
                action: 'delete',
                params: { entityType, entityId, tagId },
                result: { deleted: true }
            });
        } catch (error) {
            dbLogger.error(error, 'deleteRelation failed');
            throw error;
        }
    }

    // Note: Update and soft/hard delete operations are less common for join tables like this.
    // They are typically managed by inserting or deleting relations. This model does not include update methods.
};
