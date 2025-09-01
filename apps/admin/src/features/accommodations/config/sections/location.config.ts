import {
    EntityTypeEnum,
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { createEntityFunctions } from '@/lib/utils/entity-search.utils';
import { createI18nFieldConfig } from '@/lib/utils/i18n-field.utils';
import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { AccommodationCoreSchema } from '@repo/schemas';
import { PermissionEnum } from '@repo/types';

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
    // Create entity search functions
    const destinationSearchFns = createEntityFunctions(EntityTypeEnum.DESTINATION);

    return {
        id: 'location',
        title: 'accommodation.sections.location.title',
        description: 'accommodation.sections.location.description',
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
        },
        fields: [
            // Destination field (Entity Select)
            {
                id: 'destinationId',
                type: FieldTypeEnum.ENTITY_SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'destinationId'),
                asyncValidation: {
                    validator: commonAsyncValidators.destinationExists(),
                    trigger: ValidationTriggerEnum.ON_CHANGE
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'ENTITY_SELECT',
                    entityType: EntityTypeEnum.DESTINATION,
                    searchFn: destinationSearchFns.searchFn,
                    loadByIdsFn: destinationSearchFns.loadByIdsFn,
                    allowCreate: false, // Don't allow creating destinations from accommodation form
                    multiple: false
                },
                ...createI18nFieldConfig('accommodation.fields.destinationId')
            },

            // Address field
            {
                id: 'address',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'address'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'street-address'
                },
                ...createI18nFieldConfig('accommodation.fields.address')
            },

            // City field
            {
                id: 'city',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'city'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'address-level2'
                },
                ...createI18nFieldConfig('accommodation.fields.city')
            },

            // State/Province field
            {
                id: 'state',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'state'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'address-level1'
                },
                ...createI18nFieldConfig('accommodation.fields.state')
            },

            // Country field
            {
                id: 'country',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'country'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'country-name'
                },
                ...createI18nFieldConfig('accommodation.fields.country')
            },

            // Postal Code field
            {
                id: 'postalCode',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'postalCode'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'postal-code'
                },
                ...createI18nFieldConfig('accommodation.fields.postalCode')
            },

            // Latitude field
            {
                id: 'latitude',
                type: FieldTypeEnum.NUMBER,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'latitude'),
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
                ...createI18nFieldConfig('accommodation.fields.latitude')
            },

            // Longitude field
            {
                id: 'longitude',
                type: FieldTypeEnum.NUMBER,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'longitude'),
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
                ...createI18nFieldConfig('accommodation.fields.longitude')
            },

            // Location Notes field
            {
                id: 'locationNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'locationNotes'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 3,
                    maxLength: 500
                },
                ...createI18nFieldConfig('accommodation.fields.locationNotes')
            }
        ]
    };
};

/**
 * Static location section configuration
 * Use this for immediate access without hook dependencies
 */
export const locationSectionConfig = createLocationSectionConfig;
