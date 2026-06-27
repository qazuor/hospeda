/**
 * @file createCommerceListConfig.ts
 * Factory that produces a fully-typed `EntityConfig` for any commerce entity.
 *
 * The shared commerce filter scaffold (destination, featured, ownerId) is
 * always prepended to the filter bar.  The calling entity may inject extra
 * filters (e.g. gastronomy's type / priceRange) via `extraFilters`.
 *
 * ZERO gastronomy-specific values are hardcoded here — this file is the
 * reusable layer that SPEC-240 and future experience listings inherit.
 */

import type { EntityConfig } from '@/components/entity-list/types';
import type { CommerceEntityConfigParams } from '../types';

/**
 * Shared commerce filter order offsets.
 * Concrete entities using `extraFilters` should assign `order >= 10`
 * to appear after the shared scaffold.
 */
const SHARED_FILTER_ORDER = {
    DESTINATION: 1,
    FEATURED: 2,
    OWNER_ID: 3,
    INCLUDE_DELETED: 99
} as const;

/**
 * Builds a complete `EntityConfig` for a commerce-domain entity.
 *
 * Commerce defaults applied:
 * - Pagination: `[10, 20, 50, 100]`, default page size `20`.
 * - Search: `minChars: 2`, `debounceMs: 300`, enabled.
 * - View: table, no toggle.
 * - Layout: breadcrumbs visible, create button visible.
 * - Filter bar: destination select + featured boolean + ownerId text +
 *   includeDeleted boolean, in that order.
 *
 * Any field in `params.extraListConfig` overrides the corresponding default.
 * `params.extraFilters` are merged AFTER the shared filters (use `order >= 10`).
 *
 * @typeParam TListItem - The list-row entity type validated by `listItemSchema`.
 * @param params - Commerce entity registration params.
 * @returns A fully-typed `EntityConfig` ready for `createEntityListPage()`.
 *
 * @example
 * ```ts
 * // In the gastronomy feature (SPEC-240):
 * const gastronomyListConfig = createCommerceListConfig({
 *   entityName: 'gastronomy',
 *   entityKey: 'gastronomy',
 *   entityType: EntityType.GASTRONOMY,
 *   apiEndpoint: '/api/v1/admin/gastronomy',
 *   basePath: '/platform/gastronomy',
 *   detailPath: '/platform/gastronomy/[id]',
 *   listItemSchema: GastronomyListItemSchema,
 *   createColumns: createGastronomyColumns,
 *   extraFilters: [
 *     { paramKey: 'gastronomyType', type: 'select', labelKey: '…', order: 10, options: […] },
 *     { paramKey: 'priceRange',     type: 'select', labelKey: '…', order: 11, options: […] },
 *   ],
 * });
 * ```
 */
export function createCommerceListConfig<TListItem extends { id: string }>(
    params: CommerceEntityConfigParams<TListItem>
): EntityConfig<TListItem> {
    const {
        entityName,
        entityKey,
        entityType,
        apiEndpoint,
        basePath,
        detailPath,
        listItemSchema,
        createColumns,
        extraFilters = [],
        extraListConfig = {}
    } = params;

    // ------------------------------------------------------------------
    // Shared commerce filter scaffold (no gastronomy values here)
    // ------------------------------------------------------------------
    const sharedFilters = [
        {
            paramKey: 'destinationId',
            labelKey: 'admin-filters.destination.label' as const,
            type: 'text' as const,
            order: SHARED_FILTER_ORDER.DESTINATION,
            debounceMs: 400,
            maxLength: 36
        },
        {
            paramKey: 'isFeatured',
            labelKey: 'admin-filters.isFeatured.label' as const,
            type: 'boolean' as const,
            order: SHARED_FILTER_ORDER.FEATURED
        },
        {
            paramKey: 'ownerId',
            labelKey: 'admin-filters.ownerId.label' as const,
            type: 'text' as const,
            order: SHARED_FILTER_ORDER.OWNER_ID,
            debounceMs: 400,
            maxLength: 36
        },
        {
            paramKey: 'includeDeleted',
            labelKey: 'admin-filters.includeDeleted.label' as const,
            type: 'boolean' as const,
            order: SHARED_FILTER_ORDER.INCLUDE_DELETED
        }
    ] as const;

    // ------------------------------------------------------------------
    // Merged filter bar: shared first, then entity-specific extras.
    // We spread both arrays so the concrete entity's filters appear after.
    // ------------------------------------------------------------------
    const mergedFilters = [...sharedFilters, ...extraFilters];

    // ------------------------------------------------------------------
    // Commerce defaults — overrideable via extraListConfig
    // ------------------------------------------------------------------
    const defaultSearchConfig = {
        minChars: 2,
        debounceMs: 300,
        enabled: true
    };

    const defaultPaginationConfig = {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50, 100] as const
    };

    const defaultViewConfig = {
        defaultView: 'table' as const,
        allowViewToggle: false
    };

    const defaultLayoutConfig = {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: `${basePath}/new`
    };

    return {
        // Core identity
        name: entityName,
        entityKey,
        entityType,

        // API
        apiEndpoint,

        // Filter bar (shared + extra)
        filterBarConfig: {
            filters: mergedFilters
        },

        // Routes
        basePath,
        detailPath,

        // Schema
        listItemSchema,

        // Configuration with commerce defaults (entity can override)
        searchConfig: extraListConfig.searchConfig ?? defaultSearchConfig,
        paginationConfig: extraListConfig.paginationConfig ?? defaultPaginationConfig,
        viewConfig: extraListConfig.viewConfig ?? defaultViewConfig,
        layoutConfig: extraListConfig.layoutConfig ?? defaultLayoutConfig,

        // Optional: forward default sort if provided
        ...(extraListConfig.defaultSort !== undefined
            ? { defaultSort: extraListConfig.defaultSort }
            : {}),

        // Column factory
        createColumns
    };
}
