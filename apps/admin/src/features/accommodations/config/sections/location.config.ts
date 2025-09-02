import {
    EntityTypeEnum,
    FieldTypeEnum,
    LayoutTypeEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useConfigTranslations } from '@/lib/utils/config-i18n.utils';

import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { PermissionEnum } from '@repo/types';
import { AccommodationClientSchema } from '../../schemas/accommodation-client.schema';
import {
    stableDestinationLoadAllFn,
    stableDestinationLoadByIdsFn,
    stableDestinationSearchFn
} from '../../utils/destination-functions';

/**
 * Location section configuration for accommodation entity
 *
 * Contains location and address information:
 * - Destination relationship
 * - Full address details
 * - Geographic coordinates
 * - Location-specific settings
 */
export const createLocationSectionConfig = (): SectionConfig => {
    const { t } = useConfigTranslations();

    // Use static functions directly - they are already stable
    // No need for useMemo since they are defined outside of any component

    return {
        id: 'location',
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        title: t('accommodations.sections.location.title' as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        description: t('accommodations.sections.location.description' as any),
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
        },
        fields: [
            // Destination field (Entity Select) - Using stable functions to prevent infinite loops
            {
                id: 'destinationId',
                type: FieldTypeEnum.ENTITY_SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'destinationId'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'ENTITY_SELECT',
                    entityType: EntityTypeEnum.DESTINATION,
                    searchFn: stableDestinationSearchFn, // For server-side search (fallback)
                    loadByIdsFn: stableDestinationLoadByIdsFn,
                    loadAllFn: stableDestinationLoadAllFn, // For client-side search
                    allowCreate: false, // Don't allow creating destinations from accommodation form
                    multiple: false,
                    searchable: true, // Enable search functionality
                    clearable: true, // Allow clearing the selection
                    minSearchLength: 1, // Search from first character
                    searchMode: 'client', // Use client-side search
                    showAllWhenEmpty: true // Show all options when no search query
                },
                label: t('fields.destinationId.label'),
                description: t('fields.destinationId.description'),
                placeholder: t('fields.destinationId.placeholder')
            },

            // Address field
            {
                id: 'location.address',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'address'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'street-address'
                },
                label: t('fields.address.label'),
                description: t('fields.address.description'),
                placeholder: t('fields.address.placeholder')
            },

            // City field
            {
                id: 'location.city',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'city'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'address-level2'
                },
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                label: t('fields.city.label' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                description: t('fields.city.description' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                placeholder: t('fields.city.placeholder' as any)
            },

            // State/Province field
            {
                id: 'location.state',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'state'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'address-level1'
                },
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                label: t('fields.state.label' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                description: t('fields.state.description' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                placeholder: t('fields.state.placeholder' as any)
            },

            // Country field
            {
                id: 'location.country',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'country'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'country-name'
                },
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                label: t('fields.country.label' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                description: t('fields.country.description' as any),
                // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
                placeholder: t('fields.country.placeholder' as any)
            },

            // Postal Code field
            {
                id: 'location.postalCode',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'postalCode'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'postal-code'
                },
                label: t('fields.postalCode.label'),
                description: t('fields.postalCode.description'),
                placeholder: t('fields.postalCode.placeholder')
            },

            // Latitude field
            {
                id: 'location.latitude',
                type: FieldTypeEnum.NUMBER,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'latitude'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'NUMBER',
                    min: -90,
                    max: 90,
                    step: 0.000001,
                    precision: 6
                },
                label: t('fields.latitude.label'),
                description: t('fields.latitude.description'),
                placeholder: t('fields.latitude.placeholder')
            },

            // Longitude field
            {
                id: 'location.longitude',
                type: FieldTypeEnum.NUMBER,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'longitude'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'NUMBER',
                    min: -180,
                    max: 180,
                    step: 0.000001,
                    precision: 6
                },
                label: t('fields.longitude.label'),
                description: t('fields.longitude.description'),
                placeholder: t('fields.longitude.placeholder')
            },

            // Location Notes field
            {
                id: 'location.locationNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'locationNotes'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 3,
                    maxLength: 500
                },
                label: t('fields.locationNotes.label'),
                description: t('fields.locationNotes.description'),
                placeholder: t('fields.locationNotes.placeholder')
            }
        ]
    };
};

/**
 * Static location section configuration
 * Use this for immediate access without hook dependencies
 */
export const locationSectionConfig = createLocationSectionConfig;
