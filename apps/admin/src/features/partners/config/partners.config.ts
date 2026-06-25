import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
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
                paramKey: 'type',
                labelKey: 'admin-filters.partnerType.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'commerce', labelKey: 'admin-filters.partnerType.commerce' },
                    { value: 'ngo', labelKey: 'admin-filters.partnerType.ngo' },
                    { value: 'institution', labelKey: 'admin-filters.partnerType.institution' }
                ]
            },
            {
                paramKey: 'tier',
                labelKey: 'admin-filters.partnerTier.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'gold', labelKey: 'admin-filters.partnerTier.gold' },
                    { value: 'silver', labelKey: 'admin-filters.partnerTier.silver' },
                    { value: 'bronze', labelKey: 'admin-filters.partnerTier.bronze' }
                ]
            },
            {
                paramKey: 'subscriptionStatus',
                labelKey: 'admin-filters.partnerSubscriptionStatus.label',
                type: 'select',
                order: 3,
                options: [
                    { value: 'active', labelKey: 'admin-filters.partnerSubscriptionStatus.active' },
                    {
                        value: 'pending',
                        labelKey: 'admin-filters.partnerSubscriptionStatus.pending'
                    },
                    {
                        value: 'past_due',
                        labelKey: 'admin-filters.partnerSubscriptionStatus.past_due'
                    },
                    {
                        value: 'cancelled',
                        labelKey: 'admin-filters.partnerSubscriptionStatus.cancelled'
                    }
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
    basePath: '/partners',
    detailPath: '/partners/[id]',

    // Schemas
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
