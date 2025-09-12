import { REntityTagModel, TagModel } from '@repo/db';
import {
    type TagAddToEntityInput,
    TagAddToEntityInputSchema,
    type TagAddToEntityOutput,
    type TagCreateInput,
    TagCreateInputSchema,
    type TagGetEntitiesByTagInput,
    TagGetEntitiesByTagInputSchema,
    type TagGetEntitiesByTagOutput,
    type TagGetForEntityInput,
    TagGetForEntityInputSchema,
    type TagGetForEntityOutput,
    type TagGetPopularInput,
    TagGetPopularInputSchema,
    type TagGetPopularOutput,
    type TagRemoveFromEntityInput,
    TagRemoveFromEntityInputSchema,
    TagSearchInputSchema,
    TagUpdateInputSchema
} from '@repo/schemas';
import type {
    AccommodationId,
    DestinationId,
    EntityTagType,
    EntityTypeEnum,
    EventId,
    PostId,
    TagId,
    TagType,
    UserId
} from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './tag.normalizers';
import {
    checkCanCountTags,
    checkCanCreateTag,
    checkCanDeleteTag,
    checkCanHardDeleteTag,
    checkCanListTags,
    checkCanRestoreTag,
    checkCanSearchTags,
    checkCanSoftDeleteTag,
    checkCanUpdateTag,
    checkCanUpdateVisibilityTag,
    checkCanViewTag
} from './tag.permissions';

/**
 * Service for managing tags. Implements business logic, permissions, and hooks for Tag entities.
 * @extends BaseCrudRelatedService
 */
export class TagService extends BaseCrudRelatedService<
    TagType,
    TagModel,
    REntityTagModel,
    typeof TagCreateInputSchema,
    typeof TagUpdateInputSchema,
    typeof TagSearchInputSchema
> {
    static readonly ENTITY_NAME = 'tag';
    protected readonly entityName = TagService.ENTITY_NAME;
    /**
     * The database model for Tag.
     */
    protected readonly model: TagModel;
    /**
     * Logger instance for service actions.
     */

    /**
     * Zod schema for tag creation.
     */
    protected readonly createSchema = TagCreateInputSchema;
    /**
     * Zod schema for tag updates.
     */
    protected readonly updateSchema = TagUpdateInputSchema;
    /**
     * Zod schema for tag search/filtering.
     */
    protected readonly searchSchema = TagSearchInputSchema;

    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    /**
     * Initializes a new instance of the TagService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional TagModel instance (for testing/mocking).
     * @param relatedModel - Optional REntityTagModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: TagModel, relatedModel?: REntityTagModel) {
        super(ctx, TagService.ENTITY_NAME, relatedModel);
        this.model = model ?? new TagModel();
    }

    /**
     * Creates the default related model instance for tag-entity relations.
     */
    protected createDefaultRelatedModel(): REntityTagModel {
        return new REntityTagModel();
    }

    protected _canCreate(actor: Actor, _data: TagCreateInput): void {
        checkCanCreateTag(actor);
    }
    protected _canUpdate(actor: Actor, _entity: TagType): void {
        checkCanUpdateTag(actor, _entity);
    }
    protected _canDelete(actor: Actor, _entity: TagType): void {
        checkCanDeleteTag(actor, _entity);
    }
    protected _canRestore(actor: Actor, _entity: TagType): void {
        checkCanRestoreTag(actor, _entity);
    }
    protected _canView(actor: Actor, _entity: TagType): void {
        checkCanViewTag(actor, _entity);
    }
    protected _canList(actor: Actor): void {
        checkCanListTags(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanSearchTags(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanCountTags(actor);
    }

    /**
     * Checks if the actor can soft-delete a tag.
     * Uses TAG_DELETE permission.
     */
    protected _canSoftDelete(actor: Actor, entity: TagType): void {
        checkCanSoftDeleteTag(actor, entity);
    }

    /**
     * Checks if the actor can hard-delete a tag.
     * Uses TAG_DELETE permission (no dedicated hard delete permission).
     */
    protected _canHardDelete(actor: Actor, entity: TagType): void {
        checkCanHardDeleteTag(actor, entity);
    }

    /**
     * Checks if the actor can update the visibility of a tag.
     * Uses TAG_UPDATE permission.
     */
    protected _canUpdateVisibility(actor: Actor, entity: TagType, _newVisibility: unknown): void {
        checkCanUpdateVisibilityTag(actor, entity);
    }

    /**
     * Executes the database search for tags.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the search.
     * @returns A paginated list of tags matching the criteria.
     */
    protected async _executeSearch(params: z.infer<typeof TagSearchInputSchema>, _actor: Actor) {
        const { filters = {}, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        return this.model.findAll(filters, { page, pageSize });
    }

    /**
     * Executes the database count for tags.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of tags matching the criteria.
     */
    protected async _executeCount(params: z.infer<typeof TagSearchInputSchema>, _actor: Actor) {
        const { filters = {} } = params;
        const count = await this.model.count(filters);
        return { count };
    }

    /**
     * Returns the most popular tags (by usage count).
     * @param actor - The actor performing the action.
     * @param params - Optional limit for the number of tags.
     * @returns ServiceOutput with an array of TagType.
     */
    public async getPopularTags(
        actor: Actor,
        params: TagGetPopularInput
    ): Promise<ServiceOutput<TagGetPopularOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPopularTags',
            input: { actor, ...params },
            schema: TagGetPopularInputSchema,
            execute: async (validated) => {
                this._canList(actor);
                const results = await this.relatedModel.findPopularTags(validated.limit ?? 10);
                const tagsList: TagType[] = results.map((row) => row.tag as TagType);
                return { tags: tagsList };
            }
        });
    }

    /**
     * Adds a tag to an entity (polymorphic).
     * @param actor - The actor performing the action.
     * @param params - tagId, entityId, entityType.
     * @returns ServiceOutput<TagAddToEntityOutput>
     */
    public async addTagToEntity(
        actor: Actor,
        params: TagAddToEntityInput
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addTagToEntity',
            input: { actor, ...params },
            schema: TagAddToEntityInputSchema.strict(),
            execute: async (validated) => {
                this._canUpdate(actor, { id: validated.tagId } as TagType);
                const tag = await this.model.findById(validated.tagId as TagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const existing = await this.relatedModel.findOne({
                    tagId: validated.tagId as TagId,
                    entityId: validated.entityId as
                        | AccommodationId
                        | DestinationId
                        | UserId
                        | PostId
                        | EventId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Tag already associated with entity'
                    );
                }
                await this.relatedModel.create({
                    tagId: validated.tagId as TagId,
                    entityId: validated.entityId as
                        | AccommodationId
                        | DestinationId
                        | UserId
                        | PostId
                        | EventId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                return { success: true };
            }
        });
    }

    /**
     * Removes a tag from an entity (polymorphic).
     * Requires TAG_UPDATE permission.
     * @param actor - The actor performing the action.
     * @param params - tagId, entityId, entityType.
     * @returns ServiceOutput<TagRemoveFromEntityOutput>
     */
    public async removeTagFromEntity(
        actor: Actor,
        params: TagRemoveFromEntityInput
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromEntity',
            input: { actor, ...params },
            schema: TagRemoveFromEntityInputSchema.strict(),
            execute: async (validated) => {
                this._canUpdate(actor, { id: validated.tagId } as TagType);
                const existing = await this.relatedModel.findOne({
                    tagId: validated.tagId as TagId,
                    entityId: validated.entityId as
                        | AccommodationId
                        | DestinationId
                        | UserId
                        | PostId
                        | EventId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Tag-entity relation not found'
                    );
                }
                await this.relatedModel.hardDelete({
                    tagId: validated.tagId as TagId,
                    entityId: validated.entityId as
                        | AccommodationId
                        | DestinationId
                        | UserId
                        | PostId
                        | EventId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                return { success: true };
            }
        });
    }

    /**
     * Gets all tags for a given entity (polymorphic).
     * Requires TAG_UPDATE permission.
     * @param actor - The actor performing the action.
     * @param params - entityId, entityType.
     * @returns ServiceOutput<TagGetForEntityOutput>
     */
    public async getTagsForEntity(
        actor: Actor,
        params: TagGetForEntityInput
    ): Promise<ServiceOutput<TagGetForEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForEntity',
            input: { actor, ...params },
            schema: TagGetForEntityInputSchema.strict(),
            execute: async (validated) => {
                this._canUpdate(actor, {} as TagType);
                const relations = await this.relatedModel.findAllWithTags(
                    validated.entityId,
                    validated.entityType
                );
                const tags = relations.map((rel) => rel.tag).filter(Boolean);
                return { tags };
            }
        });
    }

    /**
     * Returns all entities associated with a given tag.
     * Optionally filters by entity type.
     * Requires TAG_UPDATE permission.
     *
     * @param actor - The actor performing the action.
     * @param params - tagId (required) and entityType (optional).
     * @returns ServiceOutput with an array of { entityId, entityType }.
     */
    public async getEntitiesByTag(
        actor: Actor,
        params: TagGetEntitiesByTagInput
    ): Promise<ServiceOutput<TagGetEntitiesByTagOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEntitiesByTag',
            input: { actor, ...params },
            schema: TagGetEntitiesByTagInputSchema.strict(),
            execute: async (validated) => {
                this._canUpdate(actor, { id: validated.tagId } as TagType);
                const tag = await this.model.findById(validated.tagId as TagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const relations = await this.relatedModel.findAllWithEntities(
                    validated.tagId,
                    validated.entityType
                );
                const entities = (relations as EntityTagType[]).map((rel) => ({
                    entityId: rel.entityId as string,
                    entityType: rel.entityType as string
                }));
                return { entities };
            }
        });
    }

    // TODO [8b1090fd-a668-4c7d-8c27-4c5e4abf4f4c]: Implement permission hooks, lifecycle hooks, and custom methods as needed.
}
