import type { ZodObject } from 'zod';
import type { BaseModel, ServiceContext } from '../types';
import { BaseCrudService } from './base.crud.service';

/**
 * Abstract base class for services that manage entities with related models (e.g., tag relations).
 * Extends BaseCrudService and adds a strongly-typed relatedModel property for handling relations.
 *
 * @template TEntity The primary entity type this service manages.
 * @template TModel The Drizzle ORM model type for the entity.
 * @template TRelatedModel The model type for the related entity (e.g., relation model).
 * @template TCreateSchema The Zod schema for validating entity creation input.
 * @template TUpdateSchema The Zod schema for validating entity update input.
 * @template TSearchSchema The Zod schema for validating entity search input.
 */
export abstract class BaseCrudRelatedService<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TRelatedModel,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * The related model instance for handling entity relations.
     * Must be initialized in the constructor of the concrete service class.
     */
    protected readonly relatedModel: TRelatedModel;

    /**
     * @param ctx - Service context
     * @param entityName - Name of the entity (homogeneous, passed to super)
     * @param relatedModel - Optional related model instance
     */
    constructor(ctx: ServiceContext, entityName: string, relatedModel?: TRelatedModel) {
        super(ctx, entityName);
        this.relatedModel = relatedModel ?? this.createDefaultRelatedModel();
    }

    /**
     * Creates the default related model instance. Must be implemented by the concrete service.
     */
    protected abstract createDefaultRelatedModel(): TRelatedModel;
}
