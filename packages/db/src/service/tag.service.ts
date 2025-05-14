import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type EntityTypeEnum, type UserType } from '@repo/types';
import { EntityTagModel, type EntityTagRecord, TagModel, type TagRecord } from '../model';
import type {
    InsertEntityTagRelation,
    InsertTag,
    PaginationParams,
    SelectEntityTagRelationFilter,
    SelectTagFilter,
    UpdateTagData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('TagService');

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
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
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
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating tag', 'create', { actor: actor.id });

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(data.ownerId, actor);

        try {
            const dataWithAudit: InsertTag = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdTag = await TagModel.createTag(dataWithAudit);
            log.info('tag created successfully', 'create', { tagId: createdTag.id });
            return createdTag;
        } catch (error) {
            log.error('failed to create tag', 'create', error, { actor: actor.id });
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
    async getTagById(id: string, actor: UserType): Promise<TagRecord> {
        log.info('fetching tag by id', 'getTagById', { tagId: id, actor: actor.id });

        try {
            const tag = await TagModel.getTagById(id);
            const existingTag = assertExists(tag, `Tag ${id} not found`);

            // Check if actor is owner or admin
            TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

            log.info('tag fetched successfully', 'getTagById', { tagId: existingTag.id });
            return existingTag;
        } catch (error) {
            log.error('failed to fetch tag by id', 'getTagById', error, {
                tagId: id,
                actor: actor.id
            });
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
    async listTags(filter: SelectTagFilter, actor: UserType): Promise<TagRecord[]> {
        log.info('listing tags', 'listTags', { filter, actor: actor.id });

        try {
            // If ownerId is specified, check if actor is owner or admin
            if (filter.ownerId) {
                TagService.assertOwnerOrAdmin(filter.ownerId, actor);
            }

            const tags = await TagModel.listTags(filter);
            log.info('tags listed successfully', 'listTags', {
                count: tags.length,
                filter
            });
            return tags;
        } catch (error) {
            log.error('failed to list tags', 'listTags', error, { filter, actor: actor.id });
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
    async updateTag(id: string, changes: UpdateTagData, actor: UserType): Promise<TagRecord> {
        log.info('updating tag', 'updateTag', { tagId: id, actor: actor.id });

        const existingTag = await this.getTagById(id, actor);

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

            log.info('tag updated successfully', 'updateTag', { tagId: updatedTag.id });
            return updatedTag;
        } catch (error) {
            log.error('failed to update tag', 'updateTag', error, {
                tagId: id,
                actor: actor.id
            });
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
        log.info('soft deleting tag', 'delete', { tagId: id, actor: actor.id });

        const existingTag = await this.getTagById(id, actor);

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

        try {
            // Use softDeleteTag method instead of updateTag with deletedAt
            await TagModel.softDeleteTag(id);
            log.info('tag soft deleted successfully', 'delete', { tagId: existingTag.id });
        } catch (error) {
            log.error('failed to soft delete tag', 'delete', error, {
                tagId: id,
                actor: actor.id
            });
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
        log.info('restoring tag', 'restore', { tagId: id, actor: actor.id });

        const existingTag = await this.getTagById(id, actor);

        // Check if actor is owner or admin
        TagService.assertOwnerOrAdmin(existingTag.ownerId, actor);

        try {
            // Use restoreTag method instead of updateTag with deletedAt = null
            await TagModel.restoreTag(id);
            log.info('tag restored successfully', 'restore', { tagId: existingTag.id });
        } catch (error) {
            log.error('failed to restore tag', 'restore', error, {
                tagId: id,
                actor: actor.id
            });
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
        log.info('hard deleting tag', 'hardDelete', { tagId: id, actor: actor.id });

        // Only admins can hard delete
        TagService.assertAdmin(actor);

        const existingTag = await this.getTagById(id, actor);

        try {
            await TagModel.hardDeleteTag(existingTag.id);
            log.info('tag hard deleted successfully', 'hardDelete', { tagId: existingTag.id });
        } catch (error) {
            log.error('failed to hard delete tag', 'hardDelete', error, {
                tagId: id,
                actor: actor.id
            });
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
    async addTagToEntity(
        entityType: EntityTypeEnum,
        entityId: string,
        tagId: string,
        actor: UserType
    ): Promise<EntityTagRecord> {
        log.info('adding tag to entity', 'addTagToEntity', {
            entityType,
            entityId,
            tagId,
            actor: actor.id
        });

        // Verify tag exists and actor has permission
        const tag = await this.getTagById(tagId, actor);

        try {
            const relationData: InsertEntityTagRelation = {
                entityType,
                entityId,
                tagId: tag.id
            };

            const relation = await EntityTagModel.createRelation(relationData);
            log.info('tag added to entity successfully', 'addTagToEntity', {
                entityType,
                entityId,
                tagId
            });
            return relation;
        } catch (error) {
            log.error('failed to add tag to entity', 'addTagToEntity', error, {
                entityType,
                entityId,
                tagId,
                actor: actor.id
            });
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
    async removeTagFromEntity(
        entityType: EntityTypeEnum,
        entityId: string,
        tagId: string,
        actor: UserType
    ): Promise<void> {
        log.info('removing tag from entity', 'removeTagFromEntity', {
            entityType,
            entityId,
            tagId,
            actor: actor.id
        });

        // Verify tag exists and actor has permission
        await this.getTagById(tagId, actor);

        try {
            await EntityTagModel.deleteRelation(entityType, entityId, tagId);
            log.info('tag removed from entity successfully', 'removeTagFromEntity', {
                entityType,
                entityId,
                tagId
            });
        } catch (error) {
            log.error('failed to remove tag from entity', 'removeTagFromEntity', error, {
                entityType,
                entityId,
                tagId,
                actor: actor.id
            });
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
    async listTagsForEntityId(
        entityType: EntityTypeEnum,
        entityId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<TagRecord[]> {
        log.info('listing tags for entity', 'listTagsForEntityId', {
            entityType,
            entityId,
            actor: actor.id,
            filter
        });

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

            log.info('tags listed for entity successfully', 'listTagsForEntityId', {
                entityType,
                entityId,
                count: tags.length
            });
            return tags;
        } catch (error) {
            log.error('failed to list tags for entity', 'listTagsForEntityId', error, {
                entityType,
                entityId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List tags for a specific entity type.
     * @param entityType - The type of entity.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of tag records.
     * @throws Error if listing fails.
     */
    async listTagsForEntityType(
        entityType: EntityTypeEnum,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<TagRecord[]> {
        log.info('listing tags for entity type', 'listTagsForEntityType', {
            entityType,
            actor: actor.id,
            filter
        });

        try {
            const relationFilter: SelectEntityTagRelationFilter = {
                entityType,
                ...filter
            };

            const relations = await EntityTagModel.listRelations(relationFilter);

            // Get the actual tag records (unique)
            const tagIds = new Set(relations.map((r) => r.tagId));
            const tags: TagRecord[] = [];

            for (const tagId of tagIds) {
                const tag = await TagModel.getTagById(tagId);
                if (tag) {
                    tags.push(tag);
                }
            }

            log.info('tags listed for entity type successfully', 'listTagsForEntityType', {
                entityType,
                count: tags.length
            });
            return tags;
        } catch (error) {
            log.error('failed to list tags for entity type', 'listTagsForEntityType', error, {
                entityType,
                actor: actor.id
            });
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
    async listEntitiesByTag(
        tagId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EntityTagRecord[]> {
        log.info('listing entities by tag', 'listEntitiesByTag', {
            tagId,
            actor: actor.id,
            filter
        });

        // Verify tag exists and actor has permission
        await this.getTagById(tagId, actor);

        try {
            const relationFilter: SelectEntityTagRelationFilter = {
                tagId,
                ...filter
            };

            const relations = await EntityTagModel.listRelations(relationFilter);
            log.info('entities listed by tag successfully', 'listEntitiesByTag', {
                tagId,
                count: relations.length
            });
            return relations;
        } catch (error) {
            log.error('failed to list entities by tag', 'listEntitiesByTag', error, {
                tagId,
                actor: actor.id
            });
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
    async searchTags(
        query: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<TagRecord[]> {
        log.info('searching tags', 'searchTags', { query, actor: actor.id, filter });

        try {
            const searchFilter: SelectTagFilter = {
                query,
                ...filter,
                includeDeleted: false
            };

            const tags = await TagModel.listTags(searchFilter);
            log.info('tags search completed successfully', 'searchTags', {
                query,
                count: tags.length
            });
            return tags;
        } catch (error) {
            log.error('failed to search tags', 'searchTags', error, {
                query,
                actor: actor.id
            });
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
    async getTagUsageCount(tagId: string, actor: UserType): Promise<number> {
        log.info('getting tag usage count', 'getTagUsageCount', { tagId, actor: actor.id });

        // Verify tag exists and actor has permission
        await this.getTagById(tagId, actor);

        try {
            const relations = await EntityTagModel.listRelations({ tagId });
            const count = relations.length;

            log.info('tag usage count retrieved successfully', 'getTagUsageCount', {
                tagId,
                count
            });
            return count;
        } catch (error) {
            log.error('failed to get tag usage count', 'getTagUsageCount', error, {
                tagId,
                actor: actor.id
            });
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
    async listMostUsedTags(
        limit: number,
        actor: UserType
    ): Promise<Array<{ tag: TagRecord; count: number }>> {
        log.info('listing most used tags', 'listMostUsedTags', { limit, actor: actor.id });

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

            log.info('most used tags listed successfully', 'listMostUsedTags', {
                count: result.length
            });
            return result;
        } catch (error) {
            log.error('failed to list most used tags', 'listMostUsedTags', error, {
                limit,
                actor: actor.id
            });
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
    async bulkAddTags(
        entityType: EntityTypeEnum,
        entityId: string,
        tagIds: string[],
        actor: UserType
    ): Promise<EntityTagRecord[]> {
        log.info('bulk adding tags to entity', 'bulkAddTags', {
            entityType,
            entityId,
            tagCount: tagIds.length,
            actor: actor.id
        });

        // Verify all tags exist and actor has permission
        for (const tagId of tagIds) {
            await this.getTagById(tagId, actor);
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

            log.info('tags bulk added to entity successfully', 'bulkAddTags', {
                entityType,
                entityId,
                count: relations.length
            });
            return relations;
        } catch (error) {
            log.error('failed to bulk add tags to entity', 'bulkAddTags', error, {
                entityType,
                entityId,
                tagIds,
                actor: actor.id
            });
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
    async bulkRemoveTags(
        entityType: EntityTypeEnum,
        entityId: string,
        tagIds: string[],
        actor: UserType
    ): Promise<void> {
        log.info('bulk removing tags from entity', 'bulkRemoveTags', {
            entityType,
            entityId,
            tagCount: tagIds.length,
            actor: actor.id
        });

        // Verify all tags exist and actor has permission
        for (const tagId of tagIds) {
            await this.getTagById(tagId, actor);
        }

        try {
            for (const tagId of tagIds) {
                await EntityTagModel.deleteRelation(entityType, entityId, tagId);
            }

            log.info('tags bulk removed from entity successfully', 'bulkRemoveTags', {
                entityType,
                entityId,
                count: tagIds.length
            });
        } catch (error) {
            log.error('failed to bulk remove tags from entity', 'bulkRemoveTags', error, {
                entityType,
                entityId,
                tagIds,
                actor: actor.id
            });
            throw error;
        }
    }
}
