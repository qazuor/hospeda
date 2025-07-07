import { REntityTagModel, TagModel } from '@repo/db';
import type { EntityTypeEnum, TagType } from '@repo/types';
import { z } from 'zod';
import { BaseRelatedService } from '../../base/base.related-service';
import type {
    Actor,
    ServiceContext,
    ServiceInput,
    ServiceLogger,
    ServiceOutput
} from '../../types';
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
        input: ServiceInput<{ tagId: string; entityId: string; entityType: EntityTypeEnum }>
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'addTagToEntity',
            input,
            schema: z.any(),
            execute: async (_validated, _actor) => {
                // TODO: Implement logic to add tag to entity
                return;
            }
        });
    }

    /**
     * Removes a tag from an entity (polymorphic).
     * @param input - ServiceInput with tagId, entityId, entityType.
     * @returns ServiceOutput<void>
     */
    public async removeTagFromEntity(
        input: ServiceInput<{ tagId: string; entityId: string; entityType: EntityTypeEnum }>
    ): Promise<ServiceOutput<void>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromEntity',
            input,
            schema: z.any(),
            execute: async (_validated, _actor) => {
                // TODO: Implement logic to remove tag from entity
                return;
            }
        });
    }

    /**
     * Gets all tags for a given entity (polymorphic).
     * @param input - ServiceInput with entityId, entityType.
     * @returns ServiceOutput with an array of TagType.
     */
    public async getTagsForEntity(
        input: ServiceInput<{ entityId: string; entityType: EntityTypeEnum }>
    ): Promise<ServiceOutput<{ tags: TagType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForEntity',
            input,
            schema: z.any(),
            execute: async (_validated, _actor) => {
                // TODO: Implement logic to fetch tags for entity
                return { tags: [] };
            }
        });
    }

    // TODO: Implement permission hooks, lifecycle hooks, and custom methods as needed.
}
