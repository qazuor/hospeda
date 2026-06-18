/**
 * @file experience.config.ts
 * Entity list configuration for the experience admin list page (SPEC-240 T-028).
 *
 * Uses `createCommerceListConfig` from the generic commerce layer so that the
 * shared filter scaffold (destination, featured, ownerId, includeDeleted) is
 * applied automatically. Experience-specific filters (type) are injected via
 * `extraFilters`.
 */

import { createEntityListPage } from '@/components/entity-list';
import { EntityType } from '@/components/table/DataTable';
import { createCommerceListConfig } from '@/features/commerce';
import { ExperienceAdminSchema, ExperienceTypeEnum, PermissionEnum } from '@repo/schemas';
import type { z } from 'zod';
import { createExperienceColumns } from './experience.columns';

// ---------------------------------------------------------------------------
// List-item shape
// ---------------------------------------------------------------------------

/**
 * Minimal list-item shape for the experience table.
 * Picks the subset of fields actually rendered in columns.
 */
export type ExperienceListItem = Pick<
    z.infer<typeof ExperienceAdminSchema>,
    'id' | 'name' | 'type' | 'destinationId' | 'isFeatured' | 'ownerId' | 'createdAt'
> & {
    /** Lifecycle state string rendered in the status column. */
    readonly lifecycleStatus?: string | null;
};

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const EXPERIENCE_TYPE_OPTIONS = [
    { value: ExperienceTypeEnum.CAR_RENTAL, labelKey: 'admin-filters.experienceType.carRental' },
    { value: ExperienceTypeEnum.BIKE_RENTAL, labelKey: 'admin-filters.experienceType.bikeRental' },
    {
        value: ExperienceTypeEnum.KAYAK_RENTAL,
        labelKey: 'admin-filters.experienceType.kayakRental'
    },
    { value: ExperienceTypeEnum.QUAD_RENTAL, labelKey: 'admin-filters.experienceType.quadRental' },
    { value: ExperienceTypeEnum.TOUR_GUIDE, labelKey: 'admin-filters.experienceType.tourGuide' },
    {
        value: ExperienceTypeEnum.GUIDED_VISIT,
        labelKey: 'admin-filters.experienceType.guidedVisit'
    },
    { value: ExperienceTypeEnum.EXCURSION, labelKey: 'admin-filters.experienceType.excursion' },
    { value: ExperienceTypeEnum.BOAT_TRIP, labelKey: 'admin-filters.experienceType.boatTrip' },
    {
        value: ExperienceTypeEnum.FISHING_CHARTER,
        labelKey: 'admin-filters.experienceType.fishingCharter'
    },
    {
        value: ExperienceTypeEnum.BIRD_WATCHING,
        labelKey: 'admin-filters.experienceType.birdWatching'
    },
    {
        value: ExperienceTypeEnum.CULTURAL_TOUR,
        labelKey: 'admin-filters.experienceType.culturalTour'
    },
    {
        value: ExperienceTypeEnum.WINE_TASTING,
        labelKey: 'admin-filters.experienceType.wineTasting'
    },
    {
        value: ExperienceTypeEnum.OUTDOOR_ADVENTURE,
        labelKey: 'admin-filters.experienceType.outdoorAdventure'
    },
    { value: ExperienceTypeEnum.OTHER, labelKey: 'admin-filters.experienceType.other' }
] as const;

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

/**
 * Full entity list configuration for the experience admin list page.
 * Built on top of the shared commerce layer via `createCommerceListConfig`.
 *
 * Endpoint: `GET /api/v1/admin/experiences`
 * Permissions gate: COMMERCE_VIEW_ALL
 */
export const experienceListConfig = createCommerceListConfig<ExperienceListItem>({
    entityName: 'experiences',
    entityKey: 'experience',
    entityType: EntityType.EXPERIENCE,
    apiEndpoint: '/api/v1/admin/experiences',
    basePath: '/experiences',
    detailPath: '/experiences/[id]',
    // TYPE-WORKAROUND: ExperienceAdminSchema carries branded effects from @repo/schemas;
    // structurally compatible with the list-item shape, brand-only mismatch.
    listItemSchema: ExperienceAdminSchema as unknown as import('zod').ZodSchema<ExperienceListItem>,
    createColumns: createExperienceColumns,
    extraFilters: [
        {
            paramKey: 'type',
            labelKey: 'admin-filters.experienceType.label' as const,
            type: 'select' as const,
            order: 10,
            // TYPE-WORKAROUND: option constant is a readonly tuple; the filter config expects a mutable array.
            options: EXPERIENCE_TYPE_OPTIONS as unknown as { value: string; labelKey: string }[]
        }
    ]
});

// Derive the route + component from the config via the generic list-page factory
const { component, route } = createEntityListPage(experienceListConfig);

export { component as ExperiencesPageComponent, route as ExperiencesRoute };

/** Required permission to view the experience list. */
export const EXPERIENCE_VIEW_PERMISSION = PermissionEnum.COMMERCE_VIEW_ALL;
