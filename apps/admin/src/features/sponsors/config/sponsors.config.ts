import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Sponsor, SponsorListItemSchema } from '../schemas/sponsors.schemas';
import { createSponsorsColumns } from './sponsors.columns';

export const sponsorsConfig: EntityConfig<Sponsor> = {
    name: 'sponsors',
    displayName: 'Sponsor',
    pluralDisplayName: 'Sponsors',
    entityType: EntityType.SPONSOR,

    // API
    apiEndpoint: '/api/v1/public/sponsors',

    // Routes
    basePath: '/sponsors',
    detailPath: '/sponsors/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: SponsorListItemSchema as unknown as z.ZodSchema<Sponsor>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search sponsors...',
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
        title: 'Sponsors - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Sponsor',
        createButtonPath: '/sponsors/new'
    },

    // Columns
    createColumns: createSponsorsColumns
};

const { component, route } = createEntityListPage(sponsorsConfig);
export { component as SponsorsPageComponent, route as SponsorsRoute };
