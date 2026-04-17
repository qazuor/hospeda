import { REntityTagModel, TagModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { EntityTag, EntityTypeEnum, Tag } from '@repo/schemas';
import {
    ServiceErrorCode,
    type TagAddToEntityInput,
    TagAddToEntityInputSchema,
    type TagAddToEntityOutput,
    TagAdminSearchSchema,
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
import type { z } from 'zod';
import { BaseCrudRelatedService } from '../../base/base.crud.related.service';
import type { CrudNormalizersFromSchemas } from '../../base/base.crud.types';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './tag.normalizers';
import {
    checkCanAdminList,
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
    Tag,
    TagModel,
    REntityTagModel,
    typeof TagCreateInputSchema,
    typeof TagUpdateInputSchema,
    typeof TagSearchInputSchema
> {
    static readonly ENTITY_NAME = 'tag';
    protected readonly entityName = TagService.ENTITY_NAME;
    private static readonly revalidationLogger = createLogger('tag-revalidation');
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
    /**
     * Admin search schema for tag list filtering.
     * Uses default _executeAdminSearch() because all entity-specific filter fields
     * map directly to table column names (no JSONB extraction, field renames, or range filters needed).
     */
    protected readonly adminSearchSchema = TagAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    protected normalizers: CrudNormalizersFromSchemas<
        typeof TagCreateInputSchema,
        typeof TagUpdateInputSchema,
        typeof TagSearchInputSchema
    > = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    /**
     * Initializes a new instance of the TagService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional TagModel instance (for testing/mocking).
     * @param relatedModel - Optional REntityTagModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceConfig, model?: TagModel, relatedModel?: REntityTagModel) {
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
    protected _canUpdate(actor: Actor, _entity: Tag): void {
        checkCanUpdateTag(actor, _entity);
    }
    protected _canDelete(actor: Actor, _entity: Tag): void {
        checkCanDeleteTag(actor, _entity);
    }
    protected _canRestore(actor: Actor, _entity: Tag): void {
        checkCanRestoreTag(actor, _entity);
    }
    protected _canView(actor: Actor, _entity: Tag): void {
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
    protected _canSoftDelete(actor: Actor, entity: Tag): void {
        checkCanSoftDeleteTag(actor, entity);
    }

    /**
     * Checks if the actor can hard-delete a tag.
     * Uses TAG_DELETE permission (no dedicated hard delete permission).
     */
    protected _canHardDelete(actor: Actor, entity: Tag): void {
        checkCanHardDeleteTag(actor, entity);
    }

    /**
     * Checks if the actor can update the visibility of a tag.
     * Uses TAG_UPDATE permission.
     */
    protected _canUpdateVisibility(actor: Actor, entity: Tag, _newVisibility: unknown): void {
        checkCanUpdateVisibilityTag(actor, entity);
    }
    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks entity-specific permission.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    protected async _afterCreate(entity: Tag, _actor: Actor, _ctx: ServiceContext): Promise<Tag> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdate(entity: Tag, _actor: Actor, _ctx: ServiceContext): Promise<Tag> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterUpdateVisibility(
        entity: Tag,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Tag> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return entity;
    }

    protected async _afterSoftDelete(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _afterHardDelete(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    protected async _afterRestore(
        result: { count: number },
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'tag'
            });
        } catch (error) {
            TagService.revalidationLogger.warn(
                { error, entityType: 'tag' },
                'Revalidation scheduling failed (non-blocking)'
            );
        }
        return result;
    }

    /**
     * Executes the database search for tags.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the search.
     * @returns A paginated list of tags matching the criteria.
     */
    protected async _executeSearch(
        params: z.infer<typeof TagSearchInputSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for tags.
     * @param params The validated and processed search parameters (filters, pagination, sorting).
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of tags matching the criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof TagSearchInputSchema>,
        _actor: Actor,
        _ctx: ServiceContext
    ) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    /**
     * Returns the most popular tags (by usage count).
     * @param actor - The actor performing the action.
     * @param params - Optional limit for the number of tags.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with an array of TagType.
     */
    public async getPopularTags(
        actor: Actor,
        params: TagGetPopularInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetPopularOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPopularTags',
            input: { actor, ...params },
            schema: TagGetPopularInputSchema,
            ctx,
            execute: async (validated) => {
                await this._canList(actor);
                const results = await this.relatedModel.findPopularTags({
                    limit: validated.limit ?? 10
                });
                const tagsList: Tag[] = results.map((row) => row.tag as Tag);
                return { tags: tagsList };
            }
        });
    }

    /**
     * Adds a tag to an entity (polymorphic).
     * @param actor - The actor performing the action.
     * @param params - tagId, entityId, entityType.
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagAddToEntityOutput>
     */
    public async addTagToEntity(
        actor: Actor,
        params: TagAddToEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addTagToEntity',
            input: { actor, ...params },
            schema: TagAddToEntityInputSchema.strict(),
            ctx,
            execute: async (validated) => {
                await this._canUpdate(actor, { id: validated.tagId } as Tag);
                const tag = await this.model.findById(validated.tagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const existing = await this.relatedModel.findOne({
                    tagId: validated.tagId,
                    entityId: validated.entityId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                if (existing) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Tag already associated with entity'
                    );
                }
                await this.relatedModel.create({
                    tagId: validated.tagId,
                    entityId: validated.entityId,
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagRemoveFromEntityOutput>
     */
    public async removeTagFromEntity(
        actor: Actor,
        params: TagRemoveFromEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagAddToEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromEntity',
            input: { actor, ...params },
            schema: TagRemoveFromEntityInputSchema.strict(),
            ctx,
            execute: async (validated) => {
                await this._canUpdate(actor, { id: validated.tagId } as Tag);
                const existing = await this.relatedModel.findOne({
                    tagId: validated.tagId,
                    entityId: validated.entityId,
                    entityType: validated.entityType as EntityTypeEnum
                });
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Tag-entity relation not found'
                    );
                }
                await this.relatedModel.hardDelete({
                    tagId: validated.tagId,
                    entityId: validated.entityId,
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput<TagGetForEntityOutput>
     */
    public async getTagsForEntity(
        actor: Actor,
        params: TagGetForEntityInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetForEntityOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForEntity',
            input: { actor, ...params },
            schema: TagGetForEntityInputSchema.strict(),
            ctx,
            execute: async (validated) => {
                await this._canUpdate(actor, {} as Tag);
                const relations = await this.relatedModel.findAllWithTags(
                    validated.entityId,
                    validated.entityType
                );
                const tags = relations
                    .map((rel) => rel.tag)
                    .filter(Boolean) as unknown as TagGetForEntityOutput['tags'];
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
     * @param ctx - Optional service context carrying transaction and hookState.
     * @returns ServiceOutput with an array of { entityId, entityType }.
     */
    public async getEntitiesByTag(
        actor: Actor,
        params: TagGetEntitiesByTagInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<TagGetEntitiesByTagOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEntitiesByTag',
            input: { actor, ...params },
            schema: TagGetEntitiesByTagInputSchema.strict(),
            ctx,
            execute: async (validated) => {
                await this._canUpdate(actor, { id: validated.tagId } as Tag);
                const tag = await this.model.findById(validated.tagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                const relations = await this.relatedModel.findAllWithEntities(
                    validated.tagId,
                    validated.entityType
                );
                const entities = (relations as EntityTag[]).map((rel) => ({
                    entityId: rel.entityId as string,
                    entityType: rel.entityType as string
                }));
                return { entities };
            }
        });
    }
}
