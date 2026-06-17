/**
 * @file gastronomy.config.ts
 * Entity list configuration for the gastronomy admin list page.
 *
 * Uses `createCommerceListConfig` from the generic commerce layer so that the
 * shared filter scaffold (destination, featured, ownerId, includeDeleted) is
 * applied automatically.  Gastronomy-specific filters (type, priceRange) are
 * injected via `extraFilters`.
 */

import { createEntityListPage } from '@/components/entity-list';
import { EntityType } from '@/components/table/DataTable';
import { createCommerceListConfig } from '@/features/commerce';
import {
    GastronomyAdminSchema,
    GastronomyTypeEnum,
    PermissionEnum,
    PriceRangeEnum
} from '@repo/schemas';
import type { z } from 'zod';
import { createGastronomyColumns } from './gastronomy.columns';

// ---------------------------------------------------------------------------
// List-item shape
// ---------------------------------------------------------------------------

/**
 * Minimal list-item shape for the gastronomy table.
 * Picks the subset of fields actually rendered in columns.
 */
export type GastronomyListItem = Pick<
    z.infer<typeof GastronomyAdminSchema>,
    'id' | 'name' | 'type' | 'priceRange' | 'destinationId' | 'isFeatured' | 'ownerId' | 'createdAt'
> & {
    /** Lifecycle state string rendered in the status column. */
    readonly lifecycleStatus?: string | null;
};

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const GASTRONOMY_TYPE_OPTIONS = [
    { value: GastronomyTypeEnum.RESTAURANT, labelKey: 'admin-filters.gastronomyType.restaurant' },
    { value: GastronomyTypeEnum.BAR, labelKey: 'admin-filters.gastronomyType.bar' },
    { value: GastronomyTypeEnum.CAFE, labelKey: 'admin-filters.gastronomyType.cafe' },
    { value: GastronomyTypeEnum.PARRILLA, labelKey: 'admin-filters.gastronomyType.parrilla' },
    {
        value: GastronomyTypeEnum.CERVECERIA,
        labelKey: 'admin-filters.gastronomyType.cerveceria'
    },
    {
        value: GastronomyTypeEnum.HELADERIA,
        labelKey: 'admin-filters.gastronomyType.heladeria'
    },
    {
        value: GastronomyTypeEnum.PANADERIA,
        labelKey: 'admin-filters.gastronomyType.panaderia'
    },
    {
        value: GastronomyTypeEnum.ROTISERIA,
        labelKey: 'admin-filters.gastronomyType.rotiseria'
    },
    {
        value: GastronomyTypeEnum.FOOD_TRUCK,
        labelKey: 'admin-filters.gastronomyType.foodTruck'
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
 * Full entity list configuration for the gastronomy admin list page.
 * Built on top of the shared commerce layer via `createCommerceListConfig`.
 *
 * Endpoint: `GET /api/v1/admin/gastronomies`
 * Permissions gate: COMMERCE_VIEW_ALL
 */
export const gastronomyListConfig = createCommerceListConfig<GastronomyListItem>({
    entityName: 'gastronomies',
    entityKey: 'gastronomy',
    entityType: EntityType.GASTRONOMY,
    apiEndpoint: '/api/v1/admin/gastronomies',
    basePath: '/gastronomies',
    detailPath: '/gastronomies/[id]',
    // TYPE-WORKAROUND: GastronomyAdminSchema carries branded effects from @repo/schemas;
    // structurally compatible with the list-item shape, brand-only mismatch.
    listItemSchema: GastronomyAdminSchema as unknown as import('zod').ZodSchema<GastronomyListItem>,
    createColumns: createGastronomyColumns,
    extraFilters: [
        {
            paramKey: 'type',
            labelKey: 'admin-filters.gastronomyType.label' as const,
            type: 'select' as const,
            order: 10,
            options: GASTRONOMY_TYPE_OPTIONS as unknown as { value: string; labelKey: string }[]
        },
        {
            paramKey: 'priceRange',
            labelKey: 'admin-filters.priceRange.label' as const,
            type: 'select' as const,
            order: 11,
            options: PRICE_RANGE_OPTIONS as unknown as { value: string; labelKey: string }[]
        }
    ]
});

// Derive the route + component from the config via the generic list-page factory
const { component, route } = createEntityListPage(gastronomyListConfig);

export { component as GastronomiesPageComponent, route as GastronomiesRoute };

/** Required permission to view the gastronomy list. */
export const GASTRONOMY_VIEW_PERMISSION = PermissionEnum.COMMERCE_VIEW_ALL;
