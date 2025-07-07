import { REntityTagModel, TagModel } from '@repo/db';
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
import { z } from 'zod';
import { BaseRelatedService } from '../../base/base.related-service';
import type {
    Actor,
    ServiceContext,
    ServiceInput,
    ServiceLogger,
    ServiceOutput
} from '../../types';
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
import {
    type CreateTagInput,
    CreateTagSchema,
    type GetEntitiesByTagInput,
    GetEntitiesByTagSchema,
    GetTagsForEntitySchema,
    RemoveTagFromEntitySchema,
    SearchTagSchema,
    UpdateTagSchema
} from './tag.schemas';

/**
 * Service for managing tags. Implements business logic, permissions, and hooks for Tag entities.
 * @extends BaseRelatedService
 */
export class TagService extends BaseRelatedService<
    TagType,
    TagModel,
    REntityTagModel,
    typeof CreateTagSchema,
    typeof UpdateTagSchema,
    typeof SearchTagSchema
> {
    /**
     * The entity name for logging and error messages.
     */
    protected readonly entityName = 'tag';
    /**
     * The database model for Tag.
     */
    protected readonly model: TagModel;
    /**
     * Logger instance for service actions.
     */
    protected readonly logger: ServiceLogger;
    /**
     * Zod schema for tag creation.
     */
    protected readonly createSchema = CreateTagSchema;
    /**
     * Zod schema for tag updates.
     */
    protected readonly updateSchema = UpdateTagSchema;
    /**
     * Zod schema for tag search/filtering.
     */
    protected readonly searchSchema = SearchTagSchema;

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
        super(ctx, relatedModel);
        this.logger = ctx.logger;
        this.model = model ?? new TagModel();
    }

    /**
     * Creates the default related model instance for tag-entity relations.
     */
    protected createDefaultRelatedModel(): REntityTagModel {
        return new REntityTagModel();
    }

    protected _canCreate(actor: Actor, _data: CreateTagInput): void {
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
     * @param params The validated and processed search parameters.
     * @param _actor The actor performing the search.
     * @returns A paginated list of tags matching the criteria.
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        // Use findAll for search (with optional pagination)
        return this.model.findAll(params);
    }

    /**
     * Executes the database count for tags.
     * @param params The validated and processed search parameters.
     * @param _actor The actor performing the count.
     * @returns An object containing the total count of tags matching the criteria.
     */
    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<{ count: number }> {
        // Use count for counting
        const count = await this.model.count(params);
        return { count };
    }

    /**
     * Returns the most popular tags (by usage count).
     * @param input - ServiceInput with optional limit.
     * @returns ServiceOutput with an array of TagType.
     */
    public async getPopularTags(
        input: ServiceInput<{ limit?: number }>
    ): Promise<ServiceOutput<{ tags: TagType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPopularTags',
            input,
            schema: z.object({ limit: z.number().int().positive().max(100).optional() }),
            execute: async (validated, _actor) => {
                this._canList(_actor);
                const results = await this.relatedModel.findPopularTags(validated.limit ?? 10);
                const tagsList: TagType[] = results.map((row) => row.tag as TagType);
                return { tags: tagsList };
            }
        });
    }

    /**
     * Adds a tag to an entity (polymorphic).
     * @param input - ServiceInput with tagId, entityId, entityType.
     * @returns ServiceOutput<void>
     */
    public async addTagToEntity(
        input: ServiceInput<{ tagId: string; entityId: string; entityType: string }>
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addTagToEntity',
            input,
            schema: z.object({
                tagId: z.string().min(1),
                entityId: z.string().min(1),
                entityType: z.string().min(1)
            }),
            execute: async (validated, actor) => {
                // 1. Permiso
                checkCanUpdateTag(actor, { id: validated.tagId as TagId } as TagType);
                // 2. Validar existencia de tag
                const tag = await this.model.findById(validated.tagId as TagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                // 3. Validar que no exista ya la relación
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
                // 4. Crear la relación
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
                // 5. Retornar éxito
                return;
            }
        });
    }

    /**
     * Removes a tag from an entity (polymorphic).
     * Requires TAG_UPDATE permission.
     * @param input - ServiceInput with tagId, entityId, entityType.
     * @returns ServiceOutput<void>
     */
    public async removeTagFromEntity(
        input: ServiceInput<{ tagId: string; entityId: string; entityType: string }>
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromEntity',
            input,
            schema: RemoveTagFromEntitySchema,
            execute: async (validated, actor) => {
                // 1. Permission check
                checkCanUpdateTag(actor, { id: validated.tagId as TagId } as TagType);
                // 2. Check if the relation exists
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
                // 3. Remove the relation (hard delete)
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
                // 4. Return success
                return;
            }
        });
    }

    /**
     * Gets all tags for a given entity (polymorphic).
     * Requires TAG_UPDATE permission.
     * @param input - ServiceInput with entityId, entityType.
     * @returns ServiceOutput<{ tags: TagType[] }>
     */
    public async getTagsForEntity(
        input: ServiceInput<{ entityId: string; entityType: string }>
    ): Promise<ServiceOutput<{ tags: TagType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForEntity',
            input,
            schema: GetTagsForEntitySchema,
            execute: async (validated, actor) => {
                // 1. Permission check
                checkCanUpdateTag(actor, {} as TagType); // Only permission required
                // 2. Find all tag relations for the entity
                const relations = await this.relatedModel.findAllWithTags(
                    validated.entityId,
                    validated.entityType
                );
                // 3. Map to tags
                const tags = relations.map((rel) => rel.tag).filter(Boolean);
                // 4. Return tags array
                return { tags };
            }
        });
    }

    /**
     * Returns all entities associated with a given tag.
     * Optionally filters by entity type.
     * Requires TAG_UPDATE permission.
     *
     * @param input - ServiceInput with tagId (required) and entityType (optional).
     * @returns ServiceOutput with an array of { entityId, entityType }.
     */
    public async getEntitiesByTag(
        input: ServiceInput<GetEntitiesByTagInput>
    ): Promise<ServiceOutput<{ entities: Array<{ entityId: string; entityType: string }> }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEntitiesByTag',
            input,
            schema: GetEntitiesByTagSchema,
            execute: async (validated, actor) => {
                // Permission: require TAG_UPDATE (same as add/remove relation)
                checkCanUpdateTag(actor, { id: validated.tagId } as TagType);
                // Check tag exists
                const tag = await this.model.findById(validated.tagId as TagId);
                if (!tag) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Tag not found');
                }
                // Query relations (array plano)
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

    // TODO: Implement permission hooks, lifecycle hooks, and custom methods as needed.
}
