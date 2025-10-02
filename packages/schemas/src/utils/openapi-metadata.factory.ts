/**
 * OpenAPI Metadata Factory - Consistent metadata generation
 * Eliminates repetitive OpenAPI documentation across entities
 */

/**
 * Options for search metadata creation
 */
export type SearchMetadataOptions = {
    entityName: string;
    entityNameLower: string;
    exampleQuery?: string;
    fields?: Record<string, { description: string; example: unknown }>;
    additionalTags?: string[];
};

/**
 * Options for entity metadata creation
 */
export type EntityMetadataOptions = {
    entityName: string;
    entityNameLower: string;
    description?: string;
};

/**
 * Search metadata result type
 */
export type SearchMetadata = {
    ref: string;
    description: string;
    title: string;
    example: Record<string, unknown>;
    fields: Record<string, { description: string; example: unknown }>;
    tags: string[];
};

/**
 * Entity metadata result type
 */
export type EntityMetadata = {
    ref: string;
    description: string;
    title: string;
    tags: string[];
};

/**
 * List metadata result type
 */
export type ListMetadata = {
    ref: string;
    description: string;
    title: string;
};

/**
 * CRUD metadata result type
 */
export type CrudMetadata = {
    entity: EntityMetadata;
    search: SearchMetadata;
    list: ListMetadata;
};

/**
 * Creates search metadata for OpenAPI documentation
 */
export function createSearchMetadata(options: SearchMetadataOptions): SearchMetadata {
    const { entityName, entityNameLower, exampleQuery, fields = {}, additionalTags = [] } = options;

    const baseFields = {
        q: {
            description: `Search query for ${entityNameLower} text search`,
            example: exampleQuery || 'search text'
        },
        page: {
            description: 'Page number for pagination (1-based)',
            example: 1
        },
        pageSize: {
            description: 'Number of items per page (max 100)',
            example: 20
        },
        sortBy: {
            description: 'Field name to sort by',
            example: 'createdAt'
        },
        sortOrder: {
            description: 'Sort direction (ascending or descending)',
            example: 'desc'
        }
    };

    const example: Record<string, unknown> = {
        page: 1,
        pageSize: 20
    };

    if (exampleQuery) {
        example.q = exampleQuery;
    }

    return {
        ref: `${entityName}Search`,
        description: `Schema for searching and filtering ${entityNameLower} entities`,
        title: `${entityName} Search Parameters`,
        example,
        fields: { ...baseFields, ...fields },
        tags: [`${entityNameLower}s`, 'search', ...additionalTags]
    };
}

/**
 * Creates entity metadata for OpenAPI documentation
 */
export function createEntityMetadata(options: EntityMetadataOptions): EntityMetadata {
    const { entityName, entityNameLower, description } = options;

    return {
        ref: entityName,
        description: description || `Complete ${entityNameLower} entity schema`,
        title: `${entityName} Entity`,
        tags: [`${entityNameLower}s`]
    };
}

/**
 * Creates list metadata for OpenAPI documentation
 */
export function createListMetadata(options: EntityMetadataOptions): ListMetadata {
    const { entityName, entityNameLower } = options;

    return {
        ref: `${entityName}List`,
        description: `Paginated list of ${entityNameLower} entities`,
        title: `${entityName} List Response`
    };
}

/**
 * Creates all CRUD metadata types at once
 */
export function createCrudMetadata(
    entityName: string,
    entityNameLower: string,
    searchOptions?: Partial<SearchMetadataOptions>
): CrudMetadata {
    const baseOptions = { entityName, entityNameLower };

    return {
        entity: createEntityMetadata(baseOptions),
        search: createSearchMetadata({
            ...baseOptions,
            exampleQuery: searchOptions?.exampleQuery,
            fields: searchOptions?.fields,
            additionalTags: searchOptions?.additionalTags
        }),
        list: createListMetadata(baseOptions)
    };
}

// Type aliases for backward compatibility and search options
export type SearchExample = string;
export type SearchFields = Record<string, { description: string; example: unknown }>;
