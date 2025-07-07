import type { AdminInfoType } from '@repo/types';
import type { AnyZodObject } from 'zod';
import type { BaseModel, ServiceContext } from '../types';
import { BaseService } from './base.service';

/**
 * Abstract base class for services that manage entities with related models (e.g., tag relations).
 * Extends BaseService and adds a strongly-typed relatedModel property for handling relations.
 *
 * @template TEntity The primary entity type this service manages.
 * @template TModel The Drizzle ORM model type for the entity.
 * @template TRelatedModel The model type for the related entity (e.g., relation model).
 * @template TCreateSchema The Zod schema for validating entity creation input.
 * @template TUpdateSchema The Zod schema for validating entity update input.
 * @template TSearchSchema The Zod schema for validating entity search input.
 */
export abstract class BaseRelatedService<
    TEntity extends { id: string; adminInfo?: AdminInfoType; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TRelatedModel,
    TCreateSchema extends AnyZodObject,
    TUpdateSchema extends AnyZodObject,
    TSearchSchema extends AnyZodObject
> extends BaseService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * The related model instance for handling entity relations.
     * Must be initialized in the constructor of the concrete service class.
     */
    protected readonly relatedModel: TRelatedModel;

    /**
     * Initializes a new instance of the BaseRelatedService.
     * @param ctx - The service context, containing the logger.
     * @param relatedModel - Optional related model instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, relatedModel?: TRelatedModel) {
        super(ctx);
        this.relatedModel = relatedModel ?? this.createDefaultRelatedModel();
    }

    /**
     * Creates the default related model instance. Must be implemented by the concrete service.
     */
    protected abstract createDefaultRelatedModel(): TRelatedModel;
}
