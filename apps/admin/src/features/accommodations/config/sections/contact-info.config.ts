import {
    FieldTypeEnum,
    LayoutTypeEnum,
    ValidationTriggerEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { commonAsyncValidators } from '@/lib/utils/async-validation.utils';
import { createI18nFieldConfig } from '@/lib/utils/i18n-field.utils';
import { extractFieldSchema } from '@/lib/utils/schema-extraction.utils';
import { AccommodationCoreSchema } from '@repo/schemas';
import { PermissionEnum } from '@repo/types';

/**
 * Contact Information section configuration for accommodation entity
 *
 * Contains communication and contact details:
 * - Primary email and phone
 * - Website and social media
 * - Contact person information
 * - WhatsApp and messaging platforms
 */
export const createContactInfoSectionConfig = (): SectionConfig => {
    return {
        id: 'contact-info',
        title: 'accommodation.sections.contactInfo.title',
        description: 'accommodation.sections.contactInfo.description',
        layout: LayoutTypeEnum.GRID,
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
        },
        fields: [
            // Email field
            {
                id: 'email',
                type: FieldTypeEnum.TEXT,
                required: true,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'email'),
                asyncValidation: {
                    validator: commonAsyncValidators.validEmail(true),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'email'
                },
                ...createI18nFieldConfig('accommodation.fields.email')
            },

            // Phone field
            {
                id: 'phone',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'phone'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                ...createI18nFieldConfig('accommodation.fields.phone')
            },

            // Website field
            {
                id: 'website',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'website'),
                asyncValidation: {
                    validator: commonAsyncValidators.validUrl(false),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'url'
                },
                ...createI18nFieldConfig('accommodation.fields.website')
            },

            // Contact Person Name field
            {
                id: 'contactPersonName',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'contactPersonName'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'name'
                },
                ...createI18nFieldConfig('accommodation.fields.contactPersonName')
            },

            // Contact Person Email field
            {
                id: 'contactPersonEmail',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'contactPersonEmail'),
                asyncValidation: {
                    validator: commonAsyncValidators.validEmail(false),
                    trigger: ValidationTriggerEnum.ON_BLUR
                },
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'email'
                },
                ...createI18nFieldConfig('accommodation.fields.contactPersonEmail')
            },

            // Contact Person Phone field
            {
                id: 'contactPersonPhone',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'contactPersonPhone'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                ...createI18nFieldConfig('accommodation.fields.contactPersonPhone')
            },

            // WhatsApp field
            {
                id: 'whatsapp',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'whatsapp'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT',
                    autocomplete: 'tel'
                },
                ...createI18nFieldConfig('accommodation.fields.whatsapp')
            },

            // Instagram field
            {
                id: 'instagram',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'instagram'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                ...createI18nFieldConfig('accommodation.fields.instagram')
            },

            // Facebook field
            {
                id: 'facebook',
                type: FieldTypeEnum.TEXT,
                required: false,
                // biome-ignore lint/suspicious/noExplicitAny: Zod schema type compatibility issue
                schema: extractFieldSchema(AccommodationCoreSchema as any, 'facebook'),
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
                },
                typeConfig: {
                    type: 'TEXT'
                },
                ...createI18nFieldConfig('accommodation.fields.facebook')
            }
        ]
    };
};

/**
 * Static contact info section configuration
 * Use this for immediate access without hook dependencies
 */
export const contactInfoSectionConfig = createContactInfoSectionConfig;
