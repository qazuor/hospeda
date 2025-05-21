import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type EntityTypeEnum, type UserType } from '@repo/types';
import { EntityTagModel, type EntityTagRecord, TagModel, type TagRecord } from '../model/index.js';
import type {
    InsertEntityTagRelation,
    InsertTag,
    PaginationParams,
    SelectEntityTagRelationFilter,
    SelectTagFilter,
    UpdateTagData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing tag operations.
 * Handles business logic, authorization, and interacts with the TagModel and EntityTagModel.
 */
export class TagService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the owner of the resource or an admin.
     * @param ownerId - The ID of the resource owner.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the owner nor an admin.
     */
    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !TagService.isAdmin(actor)) {
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredOwnerId: ownerId
                },
                'Forbidden access attempt'
            );
            throw new Error('Forbidden');
        }
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!TagService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new tag.
     * @param data - The data for the new tag.
     * @param actor - The user creating the tag (must be the owner or an admin).
     * @returns The created tag record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertTag, actor: UserType): Promise<TagRecord> {
        dbLogger.info({ actor: actor.id }, 'creating tag');

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(data.ownerId, actor);

        try {
            const dataWithAudit: InsertTag = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdTag = await TagModel.createTag(dataWithAudit);
            dbLogger.info({ tagId: createdTag.id }, 'tag created successfully');
            return createdTag;
        } catch (error) {
            dbLogger.error(error, 'failed to create tag');
            throw error;
        }
    }

    /**
     * Get a single tag by ID.
     * @param id - The ID of the tag to fetch.
     * @param actor - The user performing the action.
     * @returns The tag record.
     * @throws Error if tag is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<TagRecord> {
        dbLogger.info({ tagId: id, actor: actor.id }, 'fetching tag by id');

        try {
            const tag = await TagModel.getTagById(id);
            const existingTag = assertExists(tag, `Tag ${id} not found`);

            // Check if actor is owner or admin
            TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

            dbLogger.info({ tagId: existingTag.id }, 'tag fetched successfully');
            return existingTag;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch tag by id');
            throw error;
        }
    }

    /**
     * List tags with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of tag records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectTagFilter, actor: UserType): Promise<TagRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing tags');

        try {
            // If ownerId is specified, check if actor is owner or admin
            if (filter.ownerId) {
                TagService.assertOwnerOrAdmin(filter.ownerId, actor);
            }

            const tags = await TagModel.listTags(filter);
            dbLogger.info({ count: tags.length, filter }, 'tags listed successfully');
            return tags;
        } catch (error) {
            dbLogger.error(error, 'failed to list tags');
            throw error;
        }
    }

    /**
     * Update fields on an existing tag.
     * @param id - The ID of the tag to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated tag record.
     * @throws Error if tag is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateTagData, actor: UserType): Promise<TagRecord> {
        dbLogger.info({ tagId: id, actor: actor.id }, 'updating tag');

        const existingTag = await this.getById(id, actor);

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            // Add audit information manually since it's not part of UpdateTagData
            await TagModel.updateTag(existingTag.id, dataToUpdate);

            // Fetch the updated tag to return
            const updatedTag = await TagModel.getTagById(id);
            if (!updatedTag) {
                throw new Error(`Failed to retrieve updated tag ${id}`);
            }

            dbLogger.info({ tagId: updatedTag.id }, 'tag updated successfully');
            return updatedTag;
        } catch (error) {
            dbLogger.error(error, 'failed to update tag');
            throw error;
        }
    }

    /**
     * Soft-delete a tag by setting the deletedAt timestamp.
     * @param id - The ID of the tag to delete.
     * @param actor - The user performing the action.
     * @throws Error if tag is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ tagId: id, actor: actor.id }, 'soft deleting tag');

        const existingTag = await this.getById(id, actor);

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

        try {
            // Use softDeleteTag method instead of updateTag with deletedAt
            await TagModel.softDeleteTag(id);
            dbLogger.info({ tagId: existingTag.id }, 'tag soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete tag');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted tag by clearing the deletedAt timestamp.
     * @param id - The ID of the tag to restore.
     * @param actor - The user performing the action.
     * @throws Error if tag is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ tagId: id, actor: actor.id }, 'restoring tag');

        const existingTag = await this.getById(id, actor);

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

        try {
            // Use restoreTag method instead of updateTag with deletedAt = null
            await TagModel.restoreTag(id);
            dbLogger.info({ tagId: existingTag.id }, 'tag restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore tag');
            throw error;
        }
    }

    /**
     * Permanently delete a tag record from the database.
     * @param id - The ID of the tag to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if tag is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ tagId: id, actor: actor.id }, 'hard deleting tag');

        // Only admins can hard delete
        TagService.assertAdmin(actor);

        const existingTag = await this.getById(id, actor);

        try {
            await TagModel.hardDeleteTag(existingTag.id);
            dbLogger.info({ tagId: existingTag.id }, 'tag hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete tag');
            throw error;
        }
    }

    /**
     * Add a tag to an entity.
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @returns The created entity-tag relation record.
     * @throws Error if tag or entity is not found, actor is not authorized, or creation fails.
     */
    async addToEntity(
        entityType: EntityTypeEnum,
        entityId: string,
        tagId: string,
        actor: UserType
    ): Promise<EntityTagRecord> {
        dbLogger.info({ entityType, entityId, tagId, actor: actor.id }, 'adding tag to entity');

        // Verify tag exists and actor has permission
        const tag = await this.getById(tagId, actor);

        try {
            const relationData: InsertEntityTagRelation = {
                entityType,
                entityId,
                tagId: tag.id
            };

            const relation = await EntityTagModel.createRelation(relationData);
            dbLogger.info({ entityType, entityId, tagId }, 'tag added to entity successfully');
            return relation;
        } catch (error) {
            dbLogger.error(error, 'failed to add tag to entity');
            throw error;
        }
    }

    /**
     * Remove a tag from an entity.
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @throws Error if tag is not found, actor is not authorized, or deletion fails.
     */
    async removeFromEntity(
        entityType: EntityTypeEnum,
        entityId: string,
        tagId: string,
        actor: UserType
    ): Promise<void> {
        dbLogger.info({ entityType, entityId, tagId, actor: actor.id }, 'removing tag from entity');

        // Verify tag exists and actor has permission
        await this.getById(tagId, actor);

        try {
            await EntityTagModel.deleteRelation(entityType, entityId, tagId);
            dbLogger.info({ entityType, entityId, tagId }, 'tag removed from entity successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to remove tag from entity');
            throw error;
        }
    }

    /**
     * List tags for a specific entity.
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of tag records.
     * @throws Error if listing fails.
     */
    async listForEntity(
        entityType: EntityTypeEnum,
        entityId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<TagRecord[]> {
        dbLogger.info({ entityType, entityId, actor: actor.id, filter }, 'listing tags for entity');

        try {
            const relationFilter: SelectEntityTagRelationFilter = {
                entityType,
                entityId,
                ...filter
            };

            const relations = await EntityTagModel.listRelations(relationFilter);

            // Get the actual tag records
            const tags: TagRecord[] = [];
            for (const relation of relations) {
                const tag = await TagModel.getTagById(relation.tagId);
                if (tag) {
                    tags.push(tag);
                }
            }

            dbLogger.info(
                { entityType, entityId, count: tags.length },
                'tags listed for entity successfully'
            );
            return tags;
        } catch (error) {
            dbLogger.error(error, 'failed to list tags for entity');
            throw error;
        }
    }

    /**
     * List entities that have a specific tag.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of entity-tag relation records.
     * @throws Error if tag is not found, actor is not authorized, or listing fails.
     */
    async listEntities(
        tagId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EntityTagRecord[]> {
        dbLogger.info({ tagId, actor: actor.id, filter }, 'listing entities by tag');

        // Verify tag exists and actor has permission
        await this.getById(tagId, actor);

        try {
            const relationFilter: SelectEntityTagRelationFilter = {
                tagId,
                ...filter
            };

            const relations = await EntityTagModel.listRelations(relationFilter);
            dbLogger.info(
                { tagId, count: relations.length },
                'entities listed by tag successfully'
            );
            return relations;
        } catch (error) {
            dbLogger.error(error, 'failed to list entities by tag');
            throw error;
        }
    }

    /**
     * Search tags by name or display name.
     * @param query - The search query.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of matching tag records.
     * @throws Error if search fails.
     */
    async search(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<TagRecord[]> {
        dbLogger.info({ query, actor: actor.id, filter }, 'searching tags');

        try {
            const searchFilter: SelectTagFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const tags = await TagModel.listTags(searchFilter);
            dbLogger.info({ query, count: tags.length }, 'tags search completed successfully');
            return tags;
        } catch (error) {
            dbLogger.error(error, 'failed to search tags');
            throw error;
        }
    }

    /**
     * Get the number of entities using a specific tag.
     * @param tagId - The ID of the tag.
     * @param actor - The user performing the action.
     * @returns The number of entities using the tag.
     * @throws Error if tag is not found, actor is not authorized, or count fails.
     */
    async getUsageCount(tagId: string, actor: UserType): Promise<number> {
        dbLogger.info({ tagId, actor: actor.id }, 'getting tag usage count');

        // Verify tag exists and actor has permission
        await this.getById(tagId, actor);

        try {
            const relations = await EntityTagModel.listRelations({ tagId });
            const count = relations.length;

            dbLogger.info({ tagId, count }, 'tag usage count retrieved successfully');
            return count;
        } catch (error) {
            dbLogger.error(error, 'failed to get tag usage count');
            throw error;
        }
    }

    /**
     * List the most used tags.
     * @param limit - The maximum number of tags to return.
     * @param actor - The user performing the action.
     * @returns Array of tag records with usage counts.
     * @throws Error if listing fails.
     */
    async listMostUsed(
        limit: number,
        actor: UserType
    ): Promise<Array<{ tag: TagRecord; count: number }>> {
        dbLogger.info({ limit, actor: actor.id }, 'listing most used tags');

        try {
            // Get all entity-tag relations
            const allRelations = await EntityTagModel.listRelations({});

            // Count occurrences of each tag
            const tagCounts: Record<string, number> = {};
            for (const relation of allRelations) {
                if (!tagCounts[relation.tagId]) {
                    tagCounts[relation.tagId] = 0;
                }
                // Now tagCounts[relation.tagId] is guaranteed to be initialized
                tagCounts[relation.tagId] = (tagCounts[relation.tagId] || 0) + 1;
            }

            // Sort by count and take top 'limit'
            const sortedTagIds = Object.entries(tagCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, limit)
                .map(([tagId]) => tagId);

            // Get the actual tag records
            const result: Array<{ tag: TagRecord; count: number }> = [];
            for (const tagId of sortedTagIds) {
                const tag = await TagModel.getTagById(tagId);
                if (tag) {
                    result.push({
                        tag,
                        count: tagCounts[tagId] || 0 // Ensure count is never undefined
                    });
                }
            }

            dbLogger.info({ count: result.length }, 'most used tags listed successfully');
            return result;
        } catch (error) {
            dbLogger.error(error, 'failed to list most used tags');
            throw error;
        }
    }

    /**
     * Add multiple tags to an entity in a single operation.
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param tagIds - Array of tag IDs to add.
     * @param actor - The user performing the action.
     * @returns Array of created entity-tag relation records.
     * @throws Error if any tag is not found, actor is not authorized, or creation fails.
     */
    async bulkAdd(
        entityType: EntityTypeEnum,
        entityId: string,
        tagIds: string[],
        actor: UserType
    ): Promise<EntityTagRecord[]> {
        dbLogger.info(
            { entityType, entityId, tagCount: tagIds.length, actor: actor.id },
            'bulk adding tags to entity'
        );

        // Verify all tags exist and actor has permission
        for (const tagId of tagIds) {
            await this.getById(tagId, actor);
        }

        try {
            const relations: EntityTagRecord[] = [];

            for (const tagId of tagIds) {
                const relationData: InsertEntityTagRelation = {
                    entityType,
                    entityId,
                    tagId
                };

                const relation = await EntityTagModel.createRelation(relationData);
                relations.push(relation);
            }

            dbLogger.info(
                { entityType, entityId, count: relations.length },
                'tags bulk added to entity successfully'
            );
            return relations;
        } catch (error) {
            dbLogger.error(error, 'failed to bulk add tags to entity');
            throw error;
        }
    }

    /**
     * Remove multiple tags from an entity in a single operation.
     * @param entityType - The type of entity.
     * @param entityId - The ID of the entity.
     * @param tagIds - Array of tag IDs to remove.
     * @param actor - The user performing the action.
     * @throws Error if any tag is not found, actor is not authorized, or deletion fails.
     */
    async bulkRemove(
        entityType: EntityTypeEnum,
        entityId: string,
        tagIds: string[],
        actor: UserType
    ): Promise<void> {
        dbLogger.info(
            { entityType, entityId, tagCount: tagIds.length, actor: actor.id },
            'bulk removing tags from entity'
        );

        // Verify all tags exist and actor has permission
        for (const tagId of tagIds) {
            await this.getById(tagId, actor);
        }

        try {
            for (const tagId of tagIds) {
                await EntityTagModel.deleteRelation(entityType, entityId, tagId);
            }

            dbLogger.info(
                { entityType, entityId, count: tagIds.length },
                'tags bulk removed from entity successfully'
            );
        } catch (error) {
            dbLogger.error(error, 'failed to bulk remove tags from entity');
            throw error;
        }
    }
}
