import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import {
    type OwnerPromotion,
    OwnerPromotionListItemSchema
} from '../schemas/owner-promotions.schemas';
import { createOwnerPromotionsColumns } from './owner-promotions.columns';

export const ownerPromotionsConfig: EntityConfig<OwnerPromotion> = {
    name: 'owner-promotions',
    entityKey: 'ownerPromotion',
    entityType: EntityType.SPONSOR,

    // API
    apiEndpoint: '/api/v1/admin/owner-promotions',

    // Routes
    basePath: '/billing/owner-promotions',
    detailPath: '/billing/owner-promotions/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: OwnerPromotionListItemSchema as unknown as z.ZodSchema<OwnerPromotion>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Buscar por título o propietario...',
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
        showCreateButton: false
    },

    // Columns
    createColumns: createOwnerPromotionsColumns
};

const { component, route } = createEntityListPage(ownerPromotionsConfig);
export { component as OwnerPromotionsPageComponent, route as OwnerPromotionsRoute };
