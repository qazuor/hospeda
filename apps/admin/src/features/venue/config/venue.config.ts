/**
 * @file venue.config.ts
 * Entity list configuration for the venue admin list page.
 *
 * Uses `createListingListConfig` from the generic listing layer so that the
 * shared filter scaffold (destination, featured, ownerId, includeDeleted) is
 * applied automatically.  Venue-specific filters (type, priceRange) are
 * injected via `extraFilters`.
 */

import {
    PermissionEnum,
    PriceRangeEnum,
    VenueAdminListItemSchema,
    VenueTypeEnum
} from '@repo/schemas';
import type { z } from 'zod';
import { createEntityListPage } from '@/components/entity-list';
import { EntityType } from '@/components/table/DataTable';
import { createListingListConfig } from '@/features/listing';
import { createVenueColumns } from './venue.columns';

// ---------------------------------------------------------------------------
// List-item shape
// ---------------------------------------------------------------------------

/**
 * Minimal list-item shape for the venue table.
 * Picks the subset of fields actually rendered in columns.
 */
export type VenueListItem = Pick<
    z.infer<typeof VenueAdminListItemSchema>,
    | 'id'
    | 'name'
    | 'type'
    | 'priceRange'
    | 'destinationId'
    | 'featuredByEntitlement'
    | 'ownerId'
    | 'createdAt'
    | 'destination'
    | 'owner'
    | 'publicationStatus'
>;

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const VENUE_TYPE_OPTIONS = [
    { value: VenueTypeEnum.RESTAURANT, labelKey: 'admin-filters.venueType.restaurant' },
    { value: VenueTypeEnum.BAR, labelKey: 'admin-filters.venueType.bar' },
    { value: VenueTypeEnum.CAFE, labelKey: 'admin-filters.venueType.cafe' },
    { value: VenueTypeEnum.PARRILLA, labelKey: 'admin-filters.venueType.parrilla' },
    {
        value: VenueTypeEnum.CERVECERIA,
        labelKey: 'admin-filters.venueType.cerveceria'
    },
    {
        value: VenueTypeEnum.HELADERIA,
        labelKey: 'admin-filters.venueType.heladeria'
    },
    {
        value: VenueTypeEnum.PANADERIA,
        labelKey: 'admin-filters.venueType.panaderia'
    },
    {
        value: VenueTypeEnum.ROTISERIA,
        labelKey: 'admin-filters.venueType.rotiseria'
    },
    {
        value: VenueTypeEnum.FOOD_TRUCK,
        labelKey: 'admin-filters.venueType.foodTruck'
    }
] as const;

const PRICE_RANGE_OPTIONS = [
    { value: PriceRangeEnum.BUDGET, labelKey: 'admin-filters.priceRange.budget' },
    { value: PriceRangeEnum.MID, labelKey: 'admin-filters.priceRange.mid' },
    { value: PriceRangeEnum.HIGH, labelKey: 'admin-filters.priceRange.high' },
    { value: PriceRangeEnum.PREMIUM, labelKey: 'admin-filters.priceRange.premium' }
] as const;

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

/**
 * Full entity list configuration for the venue admin list page.
 * Built on top of the shared listing layer via `createListingListConfig`.
 *
 * Endpoint: `GET /api/v1/admin/venues`
 * Permissions gate: VENUE_VIEW_ALL
 */
export const venueListConfig = createListingListConfig<VenueListItem>({
    entityName: 'venues',
    entityKey: 'venue',
    entityType: EntityType.VENUE,
    apiEndpoint: '/api/v1/admin/venues',
    basePath: '/venues',
    detailPath: '/venues/[id]',
    // Use the admin LIST schema, which keeps the eager-loaded `owner` and
    // `destination` relation summaries. The base admin schema strips them, so the
    // grid could only show raw FK UUIDs in the Destino / Propietario columns.
    // TYPE-WORKAROUND: schema carries branded effects from @repo/schemas;
    // structurally compatible with the list-item shape, brand-only mismatch.
    listItemSchema: VenueAdminListItemSchema as unknown as import('zod').ZodSchema<VenueListItem>,
    createColumns: createVenueColumns,
    extraFilters: [
        {
            paramKey: 'type',
            labelKey: 'admin-filters.venueType.label' as const,
            type: 'select' as const,
            order: 10,
            // TYPE-WORKAROUND: option constant is a readonly tuple; the filter config expects a mutable array.
            options: VENUE_TYPE_OPTIONS as unknown as { value: string; labelKey: string }[]
        },
        {
            paramKey: 'priceRange',
            labelKey: 'admin-filters.priceRange.label' as const,
            type: 'select' as const,
            order: 11,
            // TYPE-WORKAROUND: option constant is a readonly tuple; the filter config expects a mutable array.
            options: PRICE_RANGE_OPTIONS as unknown as { value: string; labelKey: string }[]
        }
    ]
});

// Derive the route + component from the config via the generic list-page factory
const { component, route } = createEntityListPage(venueListConfig);

export { component as VenuesPageComponent, route as VenuesRoute };

/** Required permission to view the venue list. */
export const VENUE_VIEW_PERMISSION = PermissionEnum.VENUE_VIEW_ALL;
