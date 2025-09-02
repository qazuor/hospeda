import {
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { useConfigTranslations } from '@/lib/utils/config-i18n.utils';

import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/types';
import { AccommodationClientSchema } from '../../schemas/accommodation-client.schema';

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
    const { t } = useConfigTranslations();

    return {
        id: 'basic-info',
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        title: t('accommodations.sections.basicInfo.title' as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        description: t('accommodations.sections.basicInfo.description' as any),
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
                schema: extractFieldSchema(AccommodationClientSchema as any, 'name'),
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
                label: t('fields.name.label'),
                description: t('fields.name.description'),
                placeholder: t('fields.name.placeholder')
            },

            // Slug field
            {
                id: 'slug',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'slug'),
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
                label: t('fields.slug.label'),
                description: t('fields.slug.description'),
                help: t('fields.slug.help')
            },

            // Description field
            {
                id: 'description',
                type: FieldTypeEnum.TEXTAREA,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'description'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 4,
                    maxLength: 1000
                },
                label: t('fields.description.label'),
                description: t('fields.description.description'),
                placeholder: t('fields.description.placeholder')
            },

            // Accommodation Type field
            {
                id: 'type',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'type'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: [
                        { value: AccommodationTypeEnum.APARTMENT, label: 'Apartamento' },
                        { value: AccommodationTypeEnum.HOUSE, label: 'Casa' },
                        { value: AccommodationTypeEnum.COUNTRY_HOUSE, label: 'Casa de Campo' },
                        { value: AccommodationTypeEnum.CABIN, label: 'Cabaña' },
                        { value: AccommodationTypeEnum.HOTEL, label: 'Hotel' },
                        { value: AccommodationTypeEnum.HOSTEL, label: 'Hostel' },
                        { value: AccommodationTypeEnum.CAMPING, label: 'Camping' },
                        { value: AccommodationTypeEnum.ROOM, label: 'Habitación' },
                        { value: AccommodationTypeEnum.MOTEL, label: 'Motel' },
                        { value: AccommodationTypeEnum.RESORT, label: 'Resort' }
                    ],
                    searchable: false,
                    clearable: false
                },
                label: t('fields.type.label'),
                description: t('fields.type.description'),
                placeholder: t('fields.type.placeholder')
            },

            // Lifecycle Status field
            {
                id: 'lifecycleState',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'lifecycleState'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: [
                        { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
                        { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
                        { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
                    ],
                    searchable: false,
                    clearable: false
                },
                label: t('fields.lifecycleState.label'),
                description: t('fields.lifecycleState.description'),
                placeholder: t('fields.lifecycleState.placeholder')
            },

            // Visibility field
            {
                id: 'visibility',
                type: FieldTypeEnum.SELECT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'visibility'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE]
                },
                typeConfig: {
                    type: 'SELECT',
                    options: [
                        { value: VisibilityEnum.PUBLIC, label: 'Público' },
                        { value: VisibilityEnum.PRIVATE, label: 'Privado' },
                        { value: VisibilityEnum.RESTRICTED, label: 'Restringido' }
                    ],
                    searchable: false,
                    clearable: false
                },
                label: t('fields.visibility.label'),
                description: t('fields.visibility.description'),
                placeholder: t('fields.visibility.placeholder')
            },

            // Short Description field
            {
                id: 'shortDescription',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'shortDescription'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXTAREA',
                    minRows: 2,
                    maxLength: 200
                },
                label: t('fields.shortDescription.label'),
                description: t('fields.shortDescription.description'),
                placeholder: t('fields.shortDescription.placeholder')
            },

            // Featured field
            {
                id: 'isFeatured',
                type: FieldTypeEnum.SWITCH,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationClientSchema as any, 'isFeatured'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE]
                },
                typeConfig: {
                    type: 'SWITCH'
                },
                label: t('fields.isFeatured.label'),
                description: t('fields.isFeatured.description')
            }
        ]
    };
};

/**
 * Static basic info section configuration
 * Use this for immediate access without hook dependencies
 * Note: This is a function reference, not a function call
 */
export const basicInfoSectionConfig = createBasicInfoSectionConfig;
