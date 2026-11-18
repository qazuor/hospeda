import type { z } from 'zod';
import { loadPartnerTypeFilterOptions } from '@/components/entity-form/fields/entity-selects/utils';
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type Partner, PartnerListItemSchema } from '../schemas/partners.schemas';
import { createPartnersColumns } from './partners.columns.tsx';

export const partnersConfig: EntityConfig<Partner> = {
    name: 'partners',
    entityKey: 'partner',
    entityType: EntityType.PARTNER,

    // API
    apiEndpoint: '/api/v1/admin/partners',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                // Catalog-driven filter (HOS-2336 AC-4.2): options come from the
                // admin partner type catalog, every lifecycle state included,
                // and the API receives the type SLUG (`?type=media`).
                paramKey: 'type',
                labelKey: 'admin-filters.partnerType.label',
                type: 'select',
                order: 1,
                options: [],
                loadOptions: loadPartnerTypeFilterOptions
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
    basePath: '/partners',
    detailPath: '/partners/[id]',

    // Schemas
    // TYPE-WORKAROUND: PartnerListItemSchema is a subset schema; cast to full Partner type for DataTable typing
    listItemSchema: PartnerListItemSchema as unknown as z.ZodSchema<Partner>,

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
        createButtonPath: '/partners/new'
    },

    // Columns
    createColumns: createPartnersColumns
};

const { component, route } = createEntityListPage(partnersConfig);

export { component as PartnersPageComponent, route as PartnersRoute };
