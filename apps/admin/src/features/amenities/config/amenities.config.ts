import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Amenity, AmenityListItemSchema } from '../schemas/amenities.schemas';
import { createAmenitiesColumns } from './amenities.columns';

export const amenitiesConfig: EntityConfig<Amenity> = {
    name: 'amenities',
    entityKey: 'amenity',
    entityType: EntityType.AMENITY,

    // API
    apiEndpoint: '/api/v1/admin/amenities',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'type',
                labelKey: 'admin-filters.amenityType.label',
                type: 'select',
                order: 1,
                options: [
                    {
                        value: 'CLIMATE_CONTROL',
                        labelKey: 'admin-filters.amenityType.climateControl'
                    },
                    {
                        value: 'CONNECTIVITY',
                        labelKey: 'admin-filters.amenityType.connectivity'
                    },
                    {
                        value: 'ENTERTAINMENT',
                        labelKey: 'admin-filters.amenityType.entertainment'
                    },
                    { value: 'KITCHEN', labelKey: 'admin-filters.amenityType.kitchen' },
                    {
                        value: 'BED_AND_BATH',
                        labelKey: 'admin-filters.amenityType.bedAndBath'
                    },
                    { value: 'OUTDOORS', labelKey: 'admin-filters.amenityType.outdoors' },
                    {
                        value: 'ACCESSIBILITY',
                        labelKey: 'admin-filters.amenityType.accessibility'
                    },
                    { value: 'SERVICES', labelKey: 'admin-filters.amenityType.services' },
                    { value: 'SAFETY', labelKey: 'admin-filters.amenityType.safety' },
                    {
                        value: 'FAMILY_FRIENDLY',
                        labelKey: 'admin-filters.amenityType.familyFriendly'
                    },
                    {
                        value: 'WORK_FRIENDLY',
                        labelKey: 'admin-filters.amenityType.workFriendly'
                    },
                    {
                        value: 'GENERAL_APPLIANCES',
                        labelKey: 'admin-filters.amenityType.generalAppliances'
                    }
                ]
            },
            {
                paramKey: 'isBuiltin',
                labelKey: 'admin-filters.isBuiltin.label',
                type: 'boolean',
                order: 2
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
    basePath: '/content/accommodation-amenities',
    detailPath: '/content/accommodation-amenities/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Amenity>, but AmenityListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: AmenityListItemSchema as unknown as z.ZodSchema<Amenity>,

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
            maxFields: 9,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50, 100]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/content/accommodation-amenities/new'
    },

    // Columns
    createColumns: createAmenitiesColumns
};

const { component, route } = createEntityListPage(amenitiesConfig);
export { component as AmenitiesPageComponent, route as AmenitiesRoute };
