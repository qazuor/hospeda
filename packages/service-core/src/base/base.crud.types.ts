import type { ListRelationsConfig } from '@repo/schemas';
import type { ZodObject } from 'zod';
import type { z } from 'zod';
import type { Actor } from '../types';

/**
 * Pagination and relations options for list operations.
 */
export type ListOptions = {
    page?: number;
    pageSize?: number;
    relations?: ListRelationsConfig;
};

/**
 * Normalizer functions for CRUD operations.
 * Each normalizer can transform its respective input before the operation is executed.
 *
 * @template TCreate - The validated create input type
 * @template TUpdate - The validated update input type
 * @template TSearch - The validated search input type
 */
export type CrudNormalizers<TCreate, TUpdate, TSearch> = {
    /** Normalizes the create input before insertion. */
    create?: (data: TCreate, actor: Actor) => TCreate | Promise<TCreate>;
    /** Normalizes the update input before the update operation. */
    update?: (data: TUpdate, actor: Actor) => TUpdate | Promise<TUpdate>;
    /** Normalizes list options before the list query. */
    list?: (params: ListOptions, actor: Actor) => ListOptions | Promise<ListOptions>;
    /** Normalizes the field/value pair before a view/find operation. */
    view?: (
        field: string,
        value: unknown,
        actor: Actor
    ) => { field: string; value: unknown } | Promise<{ field: string; value: unknown }>;
    /** Normalizes the search parameters before a search query. */
    search?: (params: TSearch, actor: Actor) => TSearch | Promise<TSearch>;
};

/**
 * Utility type to infer CrudNormalizers from Zod schemas.
 *
 * @template TCreateSchema - Zod schema for create input
 * @template TUpdateSchema - Zod schema for update input
 * @template TSearchSchema - Zod schema for search input
 */
export type CrudNormalizersFromSchemas<
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> = CrudNormalizers<z.infer<TCreateSchema>, z.infer<TUpdateSchema>, z.infer<TSearchSchema>>;
