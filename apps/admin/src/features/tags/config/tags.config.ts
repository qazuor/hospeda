import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Tag, TagListItemSchema } from '../schemas/tags.schemas';
import { createTagsColumns } from './tags.columns';

export const tagsConfig: EntityConfig<Tag> = {
    name: 'tags',
    entityKey: 'tag',
    entityType: EntityType.TAG,

    // API
    apiEndpoint: '/api/v1/admin/tags',

    // Routes
    basePath: '/settings/tags',
    detailPath: '/settings/tags/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Tag>, but TagListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: TagListItemSchema as unknown as z.ZodSchema<Tag>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 6,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 25,
        allowedPageSizes: [10, 25, 50, 100]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/settings/tags/new'
    },

    // Columns
    createColumns: createTagsColumns
};

const { component, route } = createEntityListPage(tagsConfig);
export { component as TagsPageComponent, route as TagsRoute };
