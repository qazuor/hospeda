import { logger } from '@repo/logger';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import type { BaseSelectFilter } from 'src/types/db.types';
import { db } from '../client';
import { entityTagRelations } from '../schema/r_entity_tag.dbschema';
import { assertExists, castReturning, rawSelect } from '../utils/db-utils';

/**
 * Scoped logger for entity-tag relation model operations.
 */
const log = logger.createLogger('EntityTagModel');

/**
 * Full entity-tag relation record as returned by the database.
 */
export type EntityTagRecord = InferSelectModel<typeof entityTagRelations>;

/**
 * Data required to create a new entity-tag relation.
 */
export type CreateEntityTagData = InferInsertModel<typeof entityTagRelations>;

/**
 * EntityTagModel provides CRUD operations for the r_entity_tag table.
 */
export const EntityTagModel = {
    /**
     * Create a new entity-tag relation.
     *
     * @param data - Fields required to create the relation
     * @returns The created relation record
     */
    async createRelation(data: CreateEntityTagData): Promise<EntityTagRecord> {
        try {
            log.info('creating a new entity-tag relation', 'createRelation', data);
            const rows = castReturning<EntityTagRecord>(
                await db.insert(entityTagRelations).values(data).returning()
            );
            const relation = assertExists(rows[0], 'createRelation: no record returned');
            log.query('insert', 'r_entity_tag', data, relation);
            return relation;
        } catch (error) {
            log.error('createRelation failed', 'createRelation', error);
            throw error;
        }
    },

    /**
     * List relations by entity (type + id).
     *
     * @param entityType - Type of the entity
     * @param entityId - ID of the entity
     * @param filter - Pagination options
     * @returns Array of relation records
     */
    async listByEntity(
        entityType: string,
        entityId: string,
        filter?: BaseSelectFilter
    ): Promise<EntityTagRecord[]> {
        try {
            log.info('listing relations by entity', 'listByEntity', {
                entityType,
                entityId,
                filter
            });

            let query = rawSelect(
                db
                    .select()
                    .from(entityTagRelations)
                    .where(
                        and(
                            eq(entityTagRelations.entityType, entityType),
                            eq(entityTagRelations.entityId, entityId)
                        )
                    )
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(entityTagRelations.tagId, 'asc');
            }

            const rows = (await query) as EntityTagRecord[];
            log.query('select', 'r_entity_tag', { entityType, entityId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByEntity failed', 'listByEntity', error);
            throw error;
        }
    },

    /**
     * List relations by tag.
     *
     * @param tagId - ID of the tag
     * @param filter - Pagination options
     * @returns Array of relation records
     */
    async listByTag(tagId: string, filter?: BaseSelectFilter): Promise<EntityTagRecord[]> {
        try {
            log.info('listing relations by tag', 'listByTag', { tagId, filter });

            let query = rawSelect(
                db.select().from(entityTagRelations).where(eq(entityTagRelations.tagId, tagId))
            );

            if (filter) {
                query = query
                    .limit(filter.limit ?? 20)
                    .offset(filter.offset ?? 0)
                    .orderBy(entityTagRelations.entityId, 'asc');
            }

            const rows = (await query) as EntityTagRecord[];
            log.query('select', 'r_entity_tag', { tagId, filter }, rows);
            return rows;
        } catch (error) {
            log.error('listByTag failed', 'listByTag', error);
            throw error;
        }
    },

    /**
     * Delete an entity-tag relation.
     *
     * @param entityType - Type of the entity
     * @param entityId - ID of the entity
     * @param tagId - ID of the tag
     */
    async deleteRelation(entityType: string, entityId: string, tagId: string): Promise<void> {
        try {
            log.info('deleting entity-tag relation', 'deleteRelation', {
                entityType,
                entityId,
                tagId
            });
            await db
                .delete(entityTagRelations)
                .where(
                    and(
                        eq(entityTagRelations.entityType, entityType),
                        eq(entityTagRelations.entityId, entityId),
                        eq(entityTagRelations.tagId, tagId)
                    )
                );
            log.query('delete', 'r_entity_tag', { entityType, entityId, tagId }, { deleted: true });
        } catch (error) {
            log.error('deleteRelation failed', 'deleteRelation', error);
            throw error;
        }
    }
};
