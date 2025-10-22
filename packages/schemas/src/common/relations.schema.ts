/**
 * Configuration for relations to include in list operations
 * - undefined: Use service defaults or no relations
 * - {}: Explicitly no relations
 * - { relationName: true }: Include specific relations
 * - { relationName: { nestedRelation: true } }: Include nested relations
 */
export type ListRelationsConfig = Record<string, boolean | Record<string, unknown>> | undefined;

/**
 * Extended pagination options that include relations
 */
export type PaginatedListOptions = {
    page?: number;
    pageSize?: number;
    relations?: ListRelationsConfig;
};

/**
 * Base interface for models that support relations
 * Uses the existing PaginatedListOutput format from BaseModel
 */
export interface SupportsRelations<T> {
    findAllWithRelations(
        where: Record<string, unknown>,
        options: PaginatedListOptions,
        relations: Record<string, boolean>
    ): Promise<{ items: T[]; total: number }>;
}

/**
 * Standard paginated list output (matches BaseModel.findAll return type)
 */
export type PaginatedListOutput<T> = {
    items: T[];
    total: number;
};
