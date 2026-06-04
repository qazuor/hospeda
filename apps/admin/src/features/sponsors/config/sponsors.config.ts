import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Sponsor, SponsorListItemSchema } from '../schemas/sponsors.schemas';
import { createSponsorsColumns } from './sponsors.columns';

export const sponsorsConfig: EntityConfig<Sponsor> = {
    name: 'sponsors',
    entityKey: 'sponsor',
    entityType: EntityType.SPONSOR,

    // API
    apiEndpoint: '/api/v1/admin/post-sponsors',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'type',
                labelKey: 'admin-filters.clientType.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'POST_SPONSOR', labelKey: 'admin-filters.clientType.postSponsor' },
                    { value: 'ADVERTISER', labelKey: 'admin-filters.clientType.advertiser' },
                    { value: 'HOST', labelKey: 'admin-filters.clientType.host' }
                ]
            },
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    // Routes
    basePath: '/sponsors',
    detailPath: '/sponsors/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Sponsor>, but SponsorListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: SponsorListItemSchema as unknown as z.ZodSchema<Sponsor>,

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
            maxFields: 8,
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
        createButtonPath: '/sponsors/new'
    },

    // Columns
    createColumns: createSponsorsColumns
};

const { component, route } = createEntityListPage(sponsorsConfig);
export { component as SponsorsPageComponent, route as SponsorsRoute };
