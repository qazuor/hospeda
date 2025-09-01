import {
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { useCommonEnumOptions } from '@/lib/utils/enum-options.utils';
import { createI18nFieldConfig } from '@/lib/utils/i18n-field.utils';
import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { AccommodationCoreSchema } from '@repo/schemas';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/types';

/**
 * Basic Information section configuration for accommodation entity
 *
 * Contains core identification and basic properties:
 * - Name, slug, description
 * - Accommodation type
 * - Lifecycle and visibility status
 * - Basic content fields
 */
export const createBasicInfoSectionConfig = (): SectionConfig => {
    const enumOptions = useCommonEnumOptions();

    return {
        id: 'basic-info',
        title: 'accommodation.sections.basicInfo.title',
        description: 'accommodation.sections.basicInfo.description',
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
        },
        fields: [
            // Name field
            {
                id: 'name',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'name'),
                asyncValidation: {
                    validator: commonAsyncValidators.uniqueName('accommodation'),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                ...createI18nFieldConfig('accommodation.fields.name')
            },

            // Slug field
            {
                id: 'slug',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'slug'),
                asyncValidation: {
                    validator: commonAsyncValidators.uniqueSlug('accommodation'),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                ...createI18nFieldConfig('accommodation.fields.slug')
            },

            // Description field
            {
                id: 'description',
                type: FieldTypeEnum.TEXTAREA,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'description'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 4,
                    maxLength: 1000
                },
                ...createI18nFieldConfig('accommodation.fields.description')
            },

            // Accommodation Type field
            {
                id: 'type',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'type'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: enumOptions.getAccommodationTypeOptions(AccommodationTypeEnum),
                    searchable: false,
                    clearable: false
                },
                ...createI18nFieldConfig('accommodation.fields.type')
            },

            // Lifecycle Status field
            {
                id: 'lifecycleState',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'lifecycleState'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: enumOptions.getLifecycleStatusOptions(LifecycleStatusEnum),
                    searchable: false,
                    clearable: false
                },
                ...createI18nFieldConfig('accommodation.fields.lifecycleState')
            },

            // Visibility field
            {
                id: 'visibility',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'visibility'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: enumOptions.getVisibilityOptions(VisibilityEnum),
                    searchable: false,
                    clearable: false
                },
                ...createI18nFieldConfig('accommodation.fields.visibility')
            },

            // Short Description field
            {
                id: 'shortDescription',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'shortDescription'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 2,
                    maxLength: 200
                },
                ...createI18nFieldConfig('accommodation.fields.shortDescription')
            },

            // Featured field
            {
                id: 'featured',
                type: FieldTypeEnum.SELECT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'featured'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: [
                        { value: 'true', label: 'Yes', labelKey: 'common.yes' },
                        { value: 'false', label: 'No', labelKey: 'common.no' }
                    ],
                    searchable: false,
                    clearable: false
                },
                ...createI18nFieldConfig('accommodation.fields.featured')
            }
        ]
    };
};

/**
 * Static basic info section configuration
 * Use this for immediate access without hook dependencies
 */
export const basicInfoSectionConfig = createBasicInfoSectionConfig;
