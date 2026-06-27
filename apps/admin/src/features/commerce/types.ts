/**
 * @file types.ts
 * Generic commerce admin config-layer types.
 *
 * These types are ZERO-gastronomy-specific.  A concrete commerce entity
 * (gastronomy, experiences, …) registers its list page and form layer by
 * instantiating these parameter objects and passing them to the builder
 * functions in this feature.
 *
 * The types are THIN wrappers over the existing shell types (`EntityConfig`,
 * `ConsolidatedEntityConfig`) — they add only the commerce-domain contract
 * (shared filters, assign-owner, review moderation) without duplicating the
 * shell's field definitions.
 */

import type { FilterControlConfig } from '@/components/entity-list/filters/filter-types';
import type { ColumnTFunction, EntityConfig } from '@/components/entity-list/types';
import type { EntityType } from '@/components/table/DataTable';
import type { ConsolidatedEntityConfig } from '@/features/accommodations/types/consolidated-config.types';
import type { z } from 'zod';

// ---------------------------------------------------------------------------
// List / entity-config layer
// ---------------------------------------------------------------------------

/**
 * Parameters required to register a commerce entity's list page.
 *
 * Pass this to `createCommerceListConfig()` to get a fully typed `EntityConfig`
 * that can be handed directly to `createEntityListPage()`.
 *
 * @typeParam TListItem - The list-row shape validated by `listItemSchema`.
 */
export type CommerceEntityConfigParams<TListItem extends { id: string }> = {
    /**
     * Human-readable entity name key (e.g. `'gastronomy'`).
     * Used as the `name` field in `EntityConfig` and as the TanStack Query root key.
     */
    readonly entityName: string;

    /**
     * i18n translation key that resolves entity singular/plural labels (e.g. `'gastronomy'`).
     * Corresponds to `EntityConfig.entityKey`.
     */
    readonly entityKey: string;

    /**
     * Discriminant value from the `EntityType` enum for this commerce entity.
     * Each concrete entity must supply its own registered `EntityType` value.
     */
    readonly entityType: EntityType;

    /**
     * Base admin API endpoint (e.g. `'/api/v1/admin/gastronomy'`).
     * All CRUD operations are performed against this endpoint.
     */
    readonly apiEndpoint: string;

    /**
     * Base navigation path for list and breadcrumbs (e.g. `'/platform/gastronomy'`).
     */
    readonly basePath: string;

    /**
     * Path pattern for the detail page, with `[id]` placeholder
     * (e.g. `'/platform/gastronomy/[id]'`).
     */
    readonly detailPath: string;

    /**
     * Zod schema used to validate each list-row API response item.
     * Must match the shape returned by `GET ${apiEndpoint}?page=…`.
     */
    readonly listItemSchema: z.ZodSchema<TListItem>;

    /**
     * Factory that returns column definitions for the entity list table.
     * Mirrors the `EntityConfig.createColumns` signature.
     */
    readonly createColumns: EntityConfig<TListItem>['createColumns'];

    /**
     * Additional entity-specific filter controls appended to the shared
     * commerce filters (destination, featured, ownerId).
     *
     * For example, gastronomy adds `gastronomyType` and `priceRange`.
     * Evaluated as ordered-AFTER the shared filters; set `order` accordingly.
     */
    readonly extraFilters?: ReadonlyArray<FilterControlConfig>;

    /**
     * Optional overrides applied on top of the shared commerce `EntityConfig`
     * defaults (pagination, search, view, layout).
     *
     * Only the fields provided here are overridden; omitted fields keep the
     * shared commerce defaults.
     */
    readonly extraListConfig?: Partial<
        Pick<
            EntityConfig<TListItem>,
            'searchConfig' | 'viewConfig' | 'paginationConfig' | 'layoutConfig' | 'defaultSort'
        >
    >;
};

// ---------------------------------------------------------------------------
// Form / consolidated-config layer
// ---------------------------------------------------------------------------

/**
 * Parameters required to build the consolidated form configuration for a
 * commerce entity.
 *
 * Pass this to the builder in `createCommerceEntityHooks` (or use directly)
 * to extend the shared `createCommerceIdentitySection()` /
 * `createCommerceOperationalSection()` with entity-specific sections.
 *
 * The result is a `ConsolidatedEntityConfig` suitable for `EntityPageBase`
 * (view/edit flow) and `EntityCreateContent` (create flow).
 */
export type CommerceConsolidatedConfigParams = {
    /**
     * Translated singular label for the entity (e.g. `'Gastronomía'`).
     * Becomes `ConsolidatedEntityConfig.metadata.entityName`.
     */
    readonly entityName: string;

    /**
     * Translated plural label for the entity (e.g. `'Gastronómías'`).
     * Becomes `ConsolidatedEntityConfig.metadata.entityNamePlural`.
     */
    readonly entityNamePlural: string;

    /**
     * Entity-specific sections to inject AFTER the shared commerce sections
     * (`identity` and `operational`).
     *
     * Pass an empty array when no extra sections are needed.
     */
    readonly extraSections: ConsolidatedEntityConfig['sections'];

    /**
     * Optional metadata overrides (title, description).
     * When omitted, metadata is derived from `entityName` / `entityNamePlural`.
     */
    readonly metadata?: ConsolidatedEntityConfig['metadata'];
};

// ---------------------------------------------------------------------------
// Column factory re-export helper
// ---------------------------------------------------------------------------

/**
 * Alias kept here so callers can import the column translation-function type
 * from this module without reaching into the shell internals.
 */
export type { ColumnTFunction };
