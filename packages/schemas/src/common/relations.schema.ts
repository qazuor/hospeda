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
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

/**
 * Standard paginated list output (matches BaseModel.findAll return type)
 */
export type PaginatedListOutput<T> = {
    items: T[];
    total: number;
};
